// controllers/admin/adminPlansController.js
const { stripe, stripeTest } = require("../../config/stripe");
const Plan = require("../../models/planModel");
const User = require("../../models/userModel");
const { cancelAllSubscriptionsForPriceId } = require("../../utils/stripeUtils");

// @desc    Get all plans
// @route   GET /api/admin/plans
// @access  Private/Admin
const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({
      $or: [
        { stripe_test_mode: req?.user?.stripe_test_mode || false },
        { name: "Starter" },
      ],
    });
    res.json({
      success: true,
      stripe_test_mode: req?.user?.stripe_test_mode || false,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get single plan by ID
// @route   GET /api/admin/plans/:id
// @access  Private/Admin
const getPlanById = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Create new plan
// @route   POST /api/admin/plans
// @access  Private/Admin
const createPlan = async (req, res) => {
  const useTestMode = req?.user?.stripe_test_mode || false;

  try {
    const {
      name,
      billingPeriods, // Array of { period: 'week'|'month'|'year', price: number }
      description,
      features,
      isPopular,
      isActive,
    } = req.body;

    const stripeInstance = useTestMode ? stripeTest : stripe;

    // Validate required fields
    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be a string",
      });
    }

    if (
      !billingPeriods ||
      !Array.isArray(billingPeriods) ||
      billingPeriods.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one billing period is required",
      });
    }

    // Validate billing periods
    const validPeriods = ["week", "month", "year"];
    const periodSet = new Set();
    const periodPrices = {};

    for (const bp of billingPeriods) {
      if (!bp.period || !validPeriods.includes(bp.period)) {
        return res.status(400).json({
          success: false,
          message: `Invalid billing period. Must be one of: ${validPeriods.join(
            ", "
          )}`,
        });
      }

      if (periodSet.has(bp.period)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate billing period: ${bp.period}`,
        });
      }
      periodSet.add(bp.period);

      if (
        bp.price === undefined ||
        typeof bp.price !== "number" ||
        bp.price < 0
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for ${bp.period} period`,
        });
      }

      periodPrices[bp.period] = bp.price;
    }

    // Validate price relationships using priority scores
    // Higher score = longer/more valuable period
    const periodPriorityMap = {
      day: 1,
      week: 2,
      month: 3,
      year: 4,
      annual: 4, // alias for year
    };

    // Check that shorter periods (lower priority) don't cost more than longer periods (higher priority)
    const periodsWithPrices = billingPeriods.map((bp) => ({
      period: bp.period,
      price: bp.price,
      priority: periodPriorityMap[bp.period] || 0,
    }));

    for (let i = 0; i < periodsWithPrices.length; i++) {
      for (let j = 0; j < periodsWithPrices.length; j++) {
        if (i !== j) {
          const period1 = periodsWithPrices[i];
          const period2 = periodsWithPrices[j];

          // If period1 has lower priority (shorter) but higher price than period2 (longer)
          if (
            period1.priority < period2.priority &&
            period1.price > period2.price
          ) {
            const periodLabels = {
              day: "Daily",
              week: "Weekly",
              month: "Monthly",
              year: "Yearly",
              annual: "Yearly",
            };
            return res.status(400).json({
              success: false,
              message: `${
                periodLabels[period1.period] || period1.period
              } price cannot be greater than ${
                periodLabels[period2.period] || period2.period
              } price`,
            });
          }
        }
      }
    }

    if (features && !Array.isArray(features)) {
      return res
        .status(400)
        .json({ success: false, message: "Features must be an array" });
    }

    // Process features to ensure proper ordering
    const processedFeatures = features
      ? features.map((feature, index) => ({
          text: feature.text,
          isAvailable:
            feature.isAvailable !== undefined ? feature.isAvailable : true,
          order: feature.order !== undefined ? feature.order : index,
        }))
      : [];

    // Check if plan already exists
    const planExists = await Plan.findOne({
      name,
      stripe_test_mode: useTestMode,
    });
    if (planExists) {
      return res.status(400).json({
        success: false,
        message: "Plan with this name already exists",
      });
    }

    let stripeProductId = null;
    const stripePriceIds = [];

    // Create Stripe product and prices for non-Starter plans
    if (name.toLowerCase() !== "starter") {
      try {
        // Create Stripe product
        const stripeProduct = await stripeInstance.products.create({
          name: name,
          description: description || `${name} subscription plan`,
          metadata: {
            planName: name,
            createdBy: "contacts-api",
          },
        });
        stripeProductId = stripeProduct.id;

        // Create Stripe prices for each billing period
        for (const bp of billingPeriods) {
          if (bp.price > 0) {
            const stripePrice = await stripeInstance.prices.create({
              currency: "aed",
              product: stripeProductId,
              unit_amount: bp.price, // Price in cents
              recurring: {
                interval: bp.period,
              },
              metadata: {
                planName: name,
                billingPeriod: bp.period,
                createdBy: "contacts-api",
              },
            });

            stripePriceIds.push({
              priceId: stripePrice.id,
              billingPeriod: bp.period,
              price: bp.price,
            });

            console.log(
              `Created Stripe price ${stripePrice.id} for ${bp.period} billing period`
            );
          }
        }

        console.log(
          `Created Stripe product ${stripeProductId} with ${stripePriceIds.length} price(s) for plan ${name}`
        );
      } catch (stripeError) {
        console.error("Stripe creation error:", stripeError);
        return res.status(500).json({
          success: false,
          message:
            "Failed to create Stripe product/price: " + stripeError.message,
        });
      }
    } else {
      // For Starter plan, just store the billing periods without creating Stripe resources
      for (const bp of billingPeriods) {
        stripePriceIds.push({
          priceId: "starter-plan-free",
          billingPeriod: bp.period,
          price: bp.price,
        });
      }
    }

    const plan = await Plan.create({
      name,
      description,
      features: processedFeatures,
      isPopular: isPopular || false,
      isActive: isActive || true,
      stripeProductId,
      stripePriceIds,
      stripe_test_mode: useTestMode,
    });

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: plan,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Update plan
// @route   PUT /api/admin/plans/:id
// @access  Private/Admin
const updatePlan = async (req, res) => {
  const useTestMode = req.user.stripe_test_mode || false;
  try {
    const stripeInstance = useTestMode ? stripeTest : stripe;

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }

    // Prevent editing the name of Starter or Pro plans
    if (
      (plan.name === "Starter" || plan.name === "Pro") &&
      ((req.body.name && req.body.name !== plan.name) ||
        (Object.prototype.hasOwnProperty.call(req.body, "isActive") &&
          req.body.isActive !== plan.isActive))
    ) {
      return res.status(403).json({
        success: false,
        message: `Cannot change the name or active status of ${plan.name} plan. This is a protected plan.`,
      });
    }

    // Validate fields if present
    if (req.body.name && typeof req.body.name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name must be a string" });
    }

    if (req.body.billingPeriods) {
      if (
        !Array.isArray(req.body.billingPeriods) ||
        req.body.billingPeriods.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "At least one billing period is required",
        });
      }

      // Validate billing periods
      const validPeriods = ["week", "month", "year"];
      const periodSet = new Set();
      const periodPrices = {};

      for (const bp of req.body.billingPeriods) {
        if (!bp.period || !validPeriods.includes(bp.period)) {
          return res.status(400).json({
            success: false,
            message: `Invalid billing period. Must be one of: ${validPeriods.join(
              ", "
            )}`,
          });
        }

        if (periodSet.has(bp.period)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate billing period: ${bp.period}`,
          });
        }
        periodSet.add(bp.period);

        if (
          bp.price === undefined ||
          typeof bp.price !== "number" ||
          bp.price < 0
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid price for ${bp.period} period`,
          });
        }

        periodPrices[bp.period] = bp.price;
      }

      // Validate price relationships using priority scores
      // Higher score = longer/more valuable period
      const periodPriorityMap = {
        day: 1,
        week: 2,
        month: 3,
        year: 4,
        annual: 4, // alias for year
      };

      // Check that shorter periods (lower priority) don't cost more than longer periods (higher priority)
      const periodsWithPrices = req.body.billingPeriods.map((bp) => ({
        period: bp.period,
        price: bp.price,
        priority: periodPriorityMap[bp.period] || 0,
      }));

      for (let i = 0; i < periodsWithPrices.length; i++) {
        for (let j = 0; j < periodsWithPrices.length; j++) {
          if (i !== j) {
            const period1 = periodsWithPrices[i];
            const period2 = periodsWithPrices[j];

            // If period1 has lower priority (shorter) but higher price than period2 (longer)
            if (
              period1.priority < period2.priority &&
              period1.price > period2.price
            ) {
              const periodLabels = {
                day: "Daily",
                week: "Weekly",
                month: "Monthly",
                year: "Yearly",
                annual: "Yearly",
              };
              return res.status(400).json({
                success: false,
                message: `${
                  periodLabels[period1.period] || period1.period
                } price cannot be greater than ${
                  periodLabels[period2.period] || period2.period
                } price`,
              });
            }
          }
        }
      }
    }

    if (req.body.features && !Array.isArray(req.body.features)) {
      return res
        .status(400)
        .json({ success: false, message: "Features must be an array" });
    }

    // Process features to ensure proper ordering
    if (req.body.features) {
      req.body.features = req.body.features.map((feature, index) => ({
        text: feature.text,
        isAvailable:
          feature.isAvailable !== undefined ? feature.isAvailable : true,
        order: feature.order !== undefined ? feature.order : index,
      }));
    }

    // Check if name is being changed and if it conflicts with another plan
    if (req.body.name && req.body.name !== plan.name) {
      const planExists = await Plan.findOne({
        name: req.body.name,
        stripe_test_mode: useTestMode,
      });
      if (planExists) {
        return res.status(400).json({
          success: false,
          message: "Plan with this name already exists",
        });
      }
    }

    // Handle Stripe updates for billing periods
    let updatedFields = { ...req.body };

    if (req.body.billingPeriods) {
      const planName = req.body.name || plan.name;
      const newStripePriceIds = [];

      // Only update Stripe for non-Starter plans
      if (planName.toLowerCase() !== "starter" && plan.stripeProductId) {
        try {
          // Create a map of existing periods to price IDs
          const existingPeriodsMap = new Map();
          plan.stripePriceIds.forEach((sp) => {
            existingPeriodsMap.set(sp.billingPeriod, sp.priceId);
          });

          // Process each billing period
          for (const bp of req.body.billingPeriods) {
            const existingPriceId = existingPeriodsMap.get(bp.period);

            if (bp.price > 0) {
              // Check if price changed or period is new
              const existingPrice = plan.stripePriceIds.find(
                (sp) => sp.billingPeriod === bp.period
              );

              if (!existingPrice || existingPrice.price !== bp.price) {
                // Create new Stripe price
                const stripePrice = await stripeInstance.prices.create({
                  currency: "aed",
                  product: plan.stripeProductId,
                  unit_amount: bp.price,
                  recurring: {
                    interval: bp.period,
                  },
                  metadata: {
                    planName: planName,
                    billingPeriod: bp.period,
                    updatedBy: "admin-panel",
                    previousPriceId: existingPriceId || "none",
                  },
                });

                newStripePriceIds.push({
                  priceId: stripePrice.id,
                  billingPeriod: bp.period,
                  price: bp.price,
                });

                // Archive old price if it existed
                if (existingPriceId) {
                  try {
                    await stripeInstance.prices.update(existingPriceId, {
                      active: false,
                    });
                    console.log(
                      `Archived old price ${existingPriceId} for ${bp.period}`
                    );

                    // Cancel all subscriptions using this archived price
                    
                    const cancellationResults =
                      await cancelAllSubscriptionsForPriceId(
                        existingPriceId,
                        useTestMode
                      );
                    console.log(
                      `Canceled ${cancellationResults.length} subscription(s) for archived price ${existingPriceId}`
                    );
                  } catch (archiveError) {
                    console.error("Error archiving old price:", archiveError);
                  }
                }

                console.log(
                  `Created new Stripe price ${stripePrice.id} for ${bp.period} period`
                );
              } else {
                // Keep existing price
                newStripePriceIds.push({
                  priceId: existingPrice.priceId,
                  billingPeriod: bp.period,
                  price: bp.price,
                });
              }
            }
          }

          // Archive any removed periods
        
          plan.stripePriceIds.forEach((existingPrice) => {
            const stillExists = req.body.billingPeriods.some(
              (bp) => bp.period === existingPrice.billingPeriod
            );
            if (!stillExists && existingPrice.priceId !== "starter-plan-free") {
              stripeInstance.prices
                .update(existingPrice.priceId, {
                  active: false,
                })
                .then(async () => {
                  console.log(
                    `Archived removed price ${existingPrice.priceId} for ${existingPrice.billingPeriod}`
                  );

                  // Cancel all subscriptions using this archived price
                  try {
                    const cancellationResults =
                      await cancelAllSubscriptionsForPriceId(
                        existingPrice.priceId,
                        useTestMode
                      );
                    console.log(
                      `Canceled ${cancellationResults.length} subscription(s) for archived price ${existingPrice.priceId}`
                    );
                  } catch (cancelError) {
                    console.error(
                      `Error canceling subscriptions for price ${existingPrice.priceId}:`,
                      cancelError
                    );
                  }
                })
                .catch((err) => {
                  console.error("Error archiving removed price:", err);
                });
            }
          });

          updatedFields.stripePriceIds = newStripePriceIds;
        } catch (stripeError) {
          console.error("Stripe update error:", stripeError);
          return res.status(500).json({
            success: false,
            message: "Failed to update Stripe prices: " + stripeError.message,
          });
        }
      } else {
        // For Starter plan, just update the billing periods without Stripe
        updatedFields.stripePriceIds = req.body.billingPeriods.map((bp) => ({
          priceId: "starter-plan-free",
          billingPeriod: bp.period,
          price: bp.price,
        }));
      }

      // Remove billingPeriods from updatedFields as we've converted it to stripePriceIds
      delete updatedFields.billingPeriods;
    }

    // Update Stripe product name if name changed
    if (req.body.name && req.body.name !== plan.name && plan.stripeProductId) {
      try {
        await stripeInstance.products.update(plan.stripeProductId, {
          name: req.body.name,
          description:
            req.body.description || `${req.body.name} subscription plan`,
        });
        console.log(`Updated Stripe product name for plan ${req.body.name}`);
      } catch (stripeError) {
        console.error("Stripe product update error:", stripeError);
        // Don't fail the entire request for product name update
      }
    }

    const updatedPlan = await Plan.findByIdAndUpdate(
      req.params.id,
      updatedFields,
      {
        new: true,
        runValidators: true,
      }
    );

    res.json({
      success: true,
      message: "Plan updated successfully",
      data: updatedPlan,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Delete plan
// @route   DELETE /api/admin/plans/:id
// @access  Private/Admin
const deletePlan = async (req, res) => {
  try {
    const useTestMode = req.user.stripe_test_mode || false;
    const stripeInstance = useTestMode ? stripeTest : stripe;

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }

    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }

    // Prevent deletion of Starter or Pro plans
    if (plan.name === "Starter" || plan.name === "Pro") {
      return res.status(403).json({
        success: false,
        message: `Cannot delete ${plan.name} plan. This is a protected plan.`,
      });
    }

    // Check if any users are currently assigned to this plan
    // const User = require("../../models/User");
    // const usersWithPlan = await User.countDocuments({ plan: req.params.id });

    // if (usersWithPlan > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `Cannot delete plan. ${usersWithPlan} user(s) are currently assigned to this plan.`,
    //   });
    // }

    // Archive Stripe resources if they exist
    if (plan.stripePriceIds?.length > 0 || plan.stripeProductId) {
      try {
      

        // Archive all prices and cancel their subscriptions
        if (plan.stripePriceIds && plan.stripePriceIds.length > 0) {
          for (const priceInfo of plan.stripePriceIds) {
            if (
              priceInfo.priceId &&
              priceInfo.priceId !== "starter-plan-free"
            ) {
              try {
                // First, cancel all subscriptions using this price
                const cancellationResults =
                  await cancelAllSubscriptionsForPriceId(
                    priceInfo.priceId,
                    useTestMode
                  );
                console.log(
                  `Canceled ${cancellationResults.length} subscription(s) for price ${priceInfo.priceId}`
                );

                // Then archive the price
                await stripeInstance.prices.update(priceInfo.priceId, {
                  active: false,
                });
                console.log(
                  `Archived Stripe price: ${priceInfo.priceId} (${priceInfo.billingPeriod})`
                );
              } catch (priceError) {
                console.error(
                  `Error archiving price ${priceInfo.priceId}:`,
                  priceError
                );
              }
            }
          }
        }

        // Archive the product
        if (plan.stripeProductId) {
          await stripeInstance.products.update(plan.stripeProductId, {
            active: false,
            metadata: {
              archivedBy: "admin-panel",
              archivedAt: new Date().toISOString(),
            },
          });
          console.log(`Archived Stripe product: ${plan.stripeProductId}`);
        }
      } catch (stripeError) {
        console.error("Stripe cleanup error:", stripeError);
        // Continue with plan deletion even if Stripe cleanup fails
      }
    }

    await Plan.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Toggle plan status
// @route   PATCH /api/admin/plans/:id/status
// @access  Private/Admin
const togglePlanStatus = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    plan.isActive = !plan.isActive;
    await plan.save();
    res.json({
      success: true,
      message: `Plan ${
        plan.isActive ? "activated" : "deactivated"
      } successfully`,
      data: plan,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
};

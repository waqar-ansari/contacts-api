// controllers/admin/adminPlansController.js
const Plan = require("../../models/planModel");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// @desc    Get all plans
// @route   GET /api/admin/plans
// @access  Private/Admin
const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json({
      success: true,
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
  try {
    const {
      name,
      price,
      pricePeriod,
      description,
      features,
      isPopular,
      isActive,
    } = req.body;

    // Validate required fields
    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be a string",
      });
    }
    if (price === undefined || typeof price !== "number" || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price is required and must be a non-negative number",
      });
    }
    if (pricePeriod && typeof pricePeriod !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Price period must be a string" });
    }
    if (features && !Array.isArray(features)) {
      return res
        .status(400)
        .json({ success: false, message: "Features must be an array" });
    }

    // Check if plan already exists
    const planExists = await Plan.findOne({ name });
    if (planExists) {
      return res.status(400).json({
        success: false,
        message: "Plan with this name already exists",
      });
    }

    let stripeProductId = null;
    let stripePriceId = null;

    // Create Stripe product and price for non-Starter plans
    if (name.toLowerCase() !== "starter" && price > 0) {
      try {
        // Create Stripe product
        const stripeProduct = await stripe.products.create({
          name: name,
          description: description || `${name} subscription plan`,
          metadata: {
            planName: name,
            createdBy: "admin-panel",
          },
        });
        stripeProductId = stripeProduct.id;

        // Create Stripe price
        const stripePrice = await stripe.prices.create({
          currency: "usd",
          product: stripeProductId,
          unit_amount: price, // Price should be in cents
          recurring: {
            interval: pricePeriod === "year" ? "year" : "month",
          },
          metadata: {
            planName: name,
            createdBy: "contacts-api",
          },
        });
        stripePriceId = stripePrice.id;

        console.log(
          `Created Stripe product ${stripeProductId} and price ${stripePriceId} for plan ${name}`
        );
      } catch (stripeError) {
        console.error("Stripe creation error:", stripeError);
        return res.status(500).json({
          success: false,
          message:
            "Failed to create Stripe product/price: " + stripeError.message,
        });
      }
    }

    const plan = await Plan.create({
      name,
      price,
      pricePeriod: pricePeriod || "month",
      description,
      features: features || [],
      isPopular: isPopular || false,
      isActive: isActive || true,
      stripeProductId,
      stripePriceId,
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
    if (
      req.body.price !== undefined &&
      (typeof req.body.price !== "number" || req.body.price < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }
    if (req.body.pricePeriod && typeof req.body.pricePeriod !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Price period must be a string" });
    }
    if (req.body.features && !Array.isArray(req.body.features)) {
      return res
        .status(400)
        .json({ success: false, message: "Features must be an array" });
    }

    // Check if name is being changed and if it conflicts with another plan
    if (req.body.name && req.body.name !== plan.name) {
      const planExists = await Plan.findOne({ name: req.body.name });
      if (planExists) {
        return res.status(400).json({
          success: false,
          message: "Plan with this name already exists",
        });
      }
    }

    // Handle Stripe updates for price/period changes
    let updatedFields = { ...req.body };

    if (
      (req.body.price !== undefined && req.body.price !== plan.price) ||
      (req.body.pricePeriod && req.body.pricePeriod !== plan.pricePeriod)
    ) {
      // Only update Stripe for non-Starter plans with actual pricing
      const newPrice =
        req.body.price !== undefined ? req.body.price : plan.price;
      const newPeriod = req.body.pricePeriod || plan.pricePeriod;
      const planName = req.body.name || plan.name;

      if (planName.toLowerCase() !== "starter" && newPrice > 0) {
        try {
          // Create new Stripe price (can't modify existing prices in Stripe)
          const stripePrice = await stripe.prices.create({
            currency: "usd",
            product: plan.stripeProductId,
            unit_amount: newPrice,
            recurring: {
              interval: newPeriod === "year" ? "year" : "month",
            },
            metadata: {
              planName: planName,
              updatedBy: "admin-panel",
              previousPriceId: plan.stripePriceId,
            },
          });

          // Archive old price
          if (plan.stripePriceId) {
            await stripe.prices.update(plan.stripePriceId, {
              active: false,
            });
          }

          updatedFields.stripePriceId = stripePrice.id;
          console.log(
            `Updated Stripe price for plan ${planName}: ${stripePrice.id}`
          );
        } catch (stripeError) {
          console.error("Stripe update error:", stripeError);
          return res.status(500).json({
            success: false,
            message: "Failed to update Stripe pricing: " + stripeError.message,
          });
        }
      }
    }

    // Update Stripe product name if name changed
    if (req.body.name && req.body.name !== plan.name && plan.stripeProductId) {
      try {
        await stripe.products.update(plan.stripeProductId, {
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
    const User = require("../../models/User");
    const usersWithPlan = await User.countDocuments({ plan: req.params.id });

    if (usersWithPlan > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete plan. ${usersWithPlan} user(s) are currently assigned to this plan.`,
      });
    }

    // Archive Stripe resources if they exist
    if (plan.stripePriceId || plan.stripeProductId) {
      try {
        // Archive the price first
        if (plan.stripePriceId) {
          await stripe.prices.update(plan.stripePriceId, {
            active: false,
          });
          console.log(`Archived Stripe price: ${plan.stripePriceId}`);
        }

        // Archive the product
        if (plan.stripeProductId) {
          await stripe.products.update(plan.stripeProductId, {
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

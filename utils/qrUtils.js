const QRCode = require("qrcode");

const generateUserQRCode = async (firstname, serialNumber) => {
  const profileId = `${firstname.toLowerCase()}${String(serialNumber).padStart(2, '0')}`;
  const profileUrl = `https://100rjobf76.execute-api.eu-north-1.amazonaws.com/shareProfile/${profileId}`;
  const qrDataURL = await QRCode.toDataURL(profileUrl);
  return { profileId, profileUrl, qrCode: qrDataURL };
};

module.exports = { generateUserQRCode };
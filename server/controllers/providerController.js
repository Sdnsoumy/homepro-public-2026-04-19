const Provider = require('../models/Provider');

exports.getNearbyProviders = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10000, category } = req.query;

    // Validate coordinates exist
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ success: false, message: 'Invalid latitude' });
    }
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: 'Invalid longitude' });
    }

    // Build query
    const query = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude], // MongoDB wants [lng, lat]
          },
          $maxDistance: parseInt(radius), // metres
        }
      },
      isAvailable: true,
      isVerified:  true,
    };

    // Add category filter only if provided
    if (category) {
      query.category = category;
    }

    const providers = await Provider.find(query)
      .populate('user', 'name email avatar phone') // only pull needed fields
      .limit(20) // never return unlimited results
      .select('-__v');

    res.json({
      success: true,
      count: providers.length,
      data:  providers,
    });

  } catch (error) {
    // The most common error here: 2dsphere index missing
    if (error.codeName === 'IndexNotFound') {
      return res.status(500).json({
        success: false,
        message: 'Geospatial index missing. Run: providerSchema.index({ location: "2dsphere" })'
      });
    }
    next(error);
  }
};

exports.registerAsProvider = async (req, res, next) => {
  try {
    const { category, description, experience, hourlyRate, lat, lng } = req.body;
    const provider = await Provider.create({
      user: req.user.id,
      category,
      description,
      experience,
      hourlyRate,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });
    res.status(201).json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
};
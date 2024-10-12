const User = require('../models/userModel');
const Community = require('../models/communityModel');
const AppError = require('../../utils/appError');
const { getDocuments, getDocument } = require('../controllers/handlerFactory');

exports.getCommunities = getDocuments(Community);

exports.getCommunity = getDocument(Community);

exports.createCommunity = async (req, res, next) => {
  const {
    name,
    moderators,
    bannedUsers,
    rules,
    avatar,
    cover,
    description,
    welcomeMessage,
    userFlairs,
    postFlairs,
  } = req.body;

  if (name.match(/^\w+$/) === null) {
    throw new AppError(
      'Community name can only contain letters, numbers and underscores',
      400
    );
  }

  const { user } = req;

  const subCreatorDoc = await User.findById(user.id).select('karma');

  if (subCreatorDoc?.karma < 49) {
    throw new AppError('You need at least 50 karma to create a community', 400);
  }
  // Remove duplicates and add the creator to the list
  const mods = moderators
    ? [...new Set(moderators.push(user?.id))]
    : [user?.id];

  const community = await Community.create({
    name,
    creator: user.id,
    moderators: mods,
    bannedUsers,
    rules,
    avatar,
    cover,
    description,
    welcomeMessage,
    userFlairs,
    postFlairs,
  });

  res.status(201).json({
    status: 'success',
    data: {
      community,
    },
  });
};

exports.updateCommunity = async (req, res, next) => {
  const {
    name,
    moderators,
    bannedUsers,
    rules,
    avatar,
    cover,
    description,
    welcomeMessage,
    userFlairs,
    postFlairs,
  } = req.body;

  const { user } = req;

  // Find the community by ID
  const community = await Community.findById(req.params.id);

  if (!community) {
    throw new AppError('Community does not exist', 404);
  }

  // Check if the user is the creator of the community
  if (community?.creator?._id.toString() !== user.id) {
    throw new AppError('You are not the creator of this community', 400);
  }

  // Ensure the creator is always included in the moderators list and duplicates are removed
  const mods = moderators
    ? Array.from(new Set([...moderators, user.id])) // Combine current moderators and the creator, then remove duplicates
    : [user.id]; // If no moderators, just add the creator

  // Update the community with the new data
  const updatedCommunity = await Community.findByIdAndUpdate(
    req.params.id,
    {
      name,
      moderators: mods, // Set the updated moderators list
      bannedUsers,
      rules,
      avatar,
      cover,
      description,
      welcomeMessage,
      userFlairs,
      postFlairs,
    },
    { new: true, runValidators: true } // Return the updated document and run validations
  );

  // Send the updated community in the response
  res.status(200).json({
    status: 'success',
    data: {
      community: updatedCommunity,
    },
  });
};

exports.deleteCommunity = async (req, res, next) => {
  const community = await Community.findById(req.params.id);

  if (!community) {
    throw new AppError('Community not found', 404);
  }

  const { user } = req;

  if (community.creator._id.toString() !== user?.id && user.role !== 'admin') {
    throw new AppError(
      'You are not the creator of this community nor the Admin',
      403
    );
  }

  await community.remove();

  res.status(204).json({
    status: 'success',
    data: null,
  });
};

exports.ban = async (req, res, next) => {
  const community = await Community.findById(req.params.id);
  const user = await User.findById(req.body.user);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!community) {
    throw new AppError('Community not found', 404);
  }

  const moderators = community.moderators.map((moderator) =>
    moderator._id.toString()
  );

  if (!moderators.includes(req.user.id)) {
    throw new AppError('You are not a moderator of this community', 400);
  }

  if (community.creator._id.toString() === req.body.user) {
    throw new AppError('Unauthorized', 400);
  }

  const bannedUsers = community?.bannedUsers?.map((userId) =>
    userId.toString()
  );

  if (bannedUsers?.includes(req.body.user)) {
    throw new AppError('User is already banned from this community', 400);
  }

  community?.bannedUsers?.push(user._id);
  await community.save();

  res.status(200).json({
    status: 'success',
    data: {
      community,
    },
  });
};

exports.unban = async (req, res, next) => {
  const community = await Community.findById(req.params.id);
  const user = await User.findById(req.body.user);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!community) {
    throw new AppError('Community not found', 404);
  }

  const moderators = community.moderators.map((moderator) =>
    moderator._id.toString()
  );

  if (!moderators.includes(req.user.id)) {
    throw new AppError('You are not a moderator of this community', 400);
  }

  const bannedUsers = community?.bannedUsers?.map((userId) =>
    userId.toString()
  );

  if (bannedUsers?.includes(req.body.user)) {
    community['bannedUsers'] = bannedUsers?.filter(
      (userId) => userId !== req.body.user
    );
  } else {
    throw new AppError('User is not banned from this community', 400);
  }

  await community.save();

  res.status(200).json({
    status: 'success',
    data: {
      community,
    },
  });
};

exports.subscribe = async (req, res, next) => {
  const community = await Community.findById(req.params.id);

  if (!community) {
    throw new AppError('Community not found', 404);
  }

  const user = await User.findById(req.user.id);

  const subscribedCommunities = user.subscribedCommunities.map((community) =>
    community._id.toString()
  );

  if (subscribedCommunities?.includes(community._id.toString())) {
    throw new AppError('User is already subscribed to this community', 400);
  }

  user.subscribedCommunities.push(community._id);
  await user.save();

  community.subscribers++;

  community.save();

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
};

exports.unsubscribe = async (req, res, next) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      throw new AppError('Community not found', 404);
    }

    const user = await User.findById(req.user.id);

    // Log user and community info for debugging
    console.log('User:', user);
    console.log('Community:', community);

    const subscribedCommunities = user.subscribedCommunities.map((community) =>
      community._id.toString()
    );

    console.log('Subscribed Communities:', subscribedCommunities);

    if (!subscribedCommunities?.includes(community._id.toString())) {
      throw new AppError('User not subscribed to this community', 400);
    }

    // Use pull() to remove the community ID from the user's subscribedCommunities array
    user.subscribedCommunities.pull(community._id);
    await user.save();

    community.subscribers--;

    await community.save(); // Added await to ensure the operation completes before proceeding

    // Return success response after successful unsubscribe
    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    // Pass error to global error handler
    next(error);
  }
};

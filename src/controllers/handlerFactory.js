require('express-async-errors');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');
const Community = require('./../models/communityModel');
const User = require('./../models/userModel');

exports.getDocuments = (Model) => async (req, res, next) => {
  let query = Model.find();

  const features = new APIFeatures(query, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const documents = await features.query;

  if (!documents) {
    throw new AppError('Documents not found', 404);
  }

  res.status(200).json({
    status: 'success',
    results: documents.length,
    data: {
      documents,
    },
  });
};

exports.getDocument = (Model) => async (req, res, next) => {
  const document = await Model.findById(req.params.id);

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      document,
    },
  });
};

exports.createDocument = (Model) => async (req, res, next) => {
  const { title, description, mediaURLs, content, parent, community } =
    req.body;
  let document;
  const { user } = req;

  const communityDoc = await Community.findById(community);
  const bannedUsers = communityDoc?.bannedUsers?.map((userId) =>
    userId.toString()
  );

  if (bannedUsers?.includes(user.id)) {
    throw new AppError('You are banned from this community', 403);
  }

  // Handle different models like Post or Comment here

  res.status(201).json({
    status: 'success',
    data: {
      document,
    },
  });
};

exports.deleteDocument = (Model) => async (req, res, next) => {
  const { user } = req;

  const document = await Model.findById(req.params.id);
  if (!document) {
    throw new AppError('Document not found', 404);
  }

  const community = await Community.findById(document.community._id);
  const moderators = community.moderators.map((moderator) =>
    moderator._id.toString()
  );

  if (
    document.creator.toString() !== user.id &&
    user.role !== 'admin' &&
    !moderators.includes(user.id)
  ) {
    throw new AppError('You are not authorized to delete this document', 401);
  }

  await Model.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
};

exports.upvoteDocument = (Model) => async (req, res, next) => {
  const document = await Model.findById(req.params.id);
  const { user } = req;

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  const userDoc = await User.findById(user?.id);
  const creator = await User.findById(document.creator);

  let upvotedDocs = 'upvotedDocs';
  let downvotedDocs = 'downvotedDocs';

  if (Model.modelName === 'Post') {
    upvotedDocs = 'upvotedPosts';
    downvotedDocs = 'downvotedPosts';
  } else if (Model.modelName === 'Comment') {
    upvotedDocs = 'upvotedComments';
    downvotedDocs = 'downvotedComments';
  }

  const upvotedDocsIds = userDoc[`${upvotedDocs}`].map((doc) =>
    doc._id.toString()
  );
  const downvotedDocsIds = userDoc[`${downvotedDocs}`].map((doc) =>
    doc._id.toString()
  );

  if (upvotedDocsIds.includes(document?.id)) {
    throw new AppError('You have already upvoted', 400);
  } else {
    if (downvotedDocsIds.includes(document?.id)) {
      userDoc[`${downvotedDocs}`].pull(document?.id);
      document.downvotes--;
      creator.karma++;
    }

    userDoc[`${upvotedDocs}`].push(document?.id);
    userDoc.save();
    document.upvotes++;
    document.save();
    creator.karma++;
    creator.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      document,
    },
  });
};

exports.downvoteDocument = (Model) => async (req, res, next) => {
  const document = await Model.findById(req.params.id);
  const { user } = req;

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  const userDoc = await User.findById(user?.id);
  const creator = await User.findById(document.creator);

  let upvotedDocs = 'upvotedDocs';
  let downvotedDocs = 'downvotedDocs';

  if (Model.modelName === 'Post') {
    upvotedDocs = 'upvotedPosts';
    downvotedDocs = 'downvotedPosts';
  } else if (Model.modelName === 'Comment') {
    upvotedDocs = 'upvotedComments';
    downvotedDocs = 'downvotedComments';
  }

  const upvotedDocsIds = userDoc[`${upvotedDocs}`].map((doc) =>
    doc._id.toString()
  );
  const downvotedDocsIds = userDoc[`${downvotedDocs}`].map((doc) =>
    doc._id.toString()
  );

  if (downvotedDocsIds.includes(document?.id)) {
    throw new AppError('You have already downvoted', 400);
  } else {
    if (upvotedDocsIds.includes(document?.id)) {
      userDoc[`${upvotedDocs}`].pull(document?.id);
      document.upvotes--;
      creator.karma--;
    }

    userDoc[`${downvotedDocs}`].push(document?.id);
    userDoc.save();
    document.downvotes++;
    document.save();
    creator.karma--;
    creator.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      document,
    },
  });
};

exports.removeUpvote = (Model) => async (req, res, next) => {
  const document = await Model.findById(req.params.id);
  const { user } = req;

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  const userDoc = await User.findById(user?.id);
  const creator = await User.findById(document.creator);

  let upvotedDocs = 'upvotedDocs';
  if (Model.modelName === 'Post') {
    upvotedDocs = 'upvotedPosts';
  } else if (Model.modelName === 'Comment') {
    upvotedDocs = 'upvotedComments';
  }

  const upvotedDocsIds = userDoc[`${upvotedDocs}`].map((doc) =>
    doc._id.toString()
  );

  if (!upvotedDocsIds.includes(document?.id)) {
    throw new AppError('You have not upvoted', 400);
  } else {
    userDoc[`${upvotedDocs}`].pull(document?.id);
    document.upvotes--;
    creator.karma--;
  }

  userDoc.save();
  document.save();
  creator.save();

  res.status(200).json({
    status: 'success',
    data: {
      document,
    },
  });
};

exports.removeDownvote = (Model) => async (req, res, next) => {
  const document = await Model.findById(req.params.id);
  const { user } = req;

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  const userDoc = await User.findById(user?.id);
  const creator = await User.findById(document.creator);

  let downvotedDocs = 'downvotedDocs';
  if (Model.modelName === 'Post') {
    downvotedDocs = 'downvotedPosts';
  } else if (Model.modelName === 'Comment') {
    downvotedDocs = 'downvotedComments';
  }

  const downvotedDocsIds = userDoc[`${downvotedDocs}`].map((doc) =>
    doc._id.toString()
  );

  if (!downvotedDocsIds.includes(document?.id)) {
    throw new AppError('You have not downvoted', 400);
  } else {
    userDoc[`${downvotedDocs}`].pull(document?.id);
    document.downvotes--;
    creator.karma++;
  }

  userDoc.save();
  document.save();
  creator.save();

  res.status(200).json({
    status: 'success',
    data: {
      document,
    },
  });
};

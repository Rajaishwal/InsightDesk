import Comment from '../model/commentModel.js';
import Task from '../model/taskModel.js';

export const addComment = async (req, res) => {
  try {
    const { taskId, text } = req.body;

    const comment = await Comment.create({
      task: taskId,
      user: req.user._id,
      text,
    });

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $push: { comments: comment._id } },
      { new: true }
    );

    res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment', error });
  }
};

export const getComments = async (req, res) => {
  try {
    const { taskId } = req.params;

    const comments = await Comment.find({ task: taskId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch comments', error });
  }
};

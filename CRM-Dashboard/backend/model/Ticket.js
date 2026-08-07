import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  url:  { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String },           // mime type e.g. "image/png", "application/pdf"
}, { _id: false });

const replySchema = new mongoose.Schema({
  authorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName:  { type: String, required: true },
  authorRole:  { type: String, required: true },
  message:     { type: String, default: '' },
  attachments: [attachmentSchema],
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true },

  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:        { type: String, required: true },
  userEmail:       { type: String, required: true },
  userEmployeeId:  { type: String },

  category: {
    type: String,
    enum: ['IT Support', 'HR', 'Finance', 'Payroll', 'Leave Related', 'Other'],
    required: true,
  },
  problem:     { type: String },
  priority:    { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  description:  { type: String, required: true },
  attachments:  [attachmentSchema],

  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open',
  },

  replies: [replySchema],
}, { timestamps: true });

// Auto-generate sequential ticketId before first save
ticketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketId = `TCK-${String(count + 1001).padStart(4, '0')}`;
  }
  next();
});

ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ status: 1 });

export default mongoose.model('Ticket', ticketSchema);
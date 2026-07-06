import mongoose from 'mongoose';

const PayslipSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  month: { type: String, required: true }, // e.g., 'August 2025'
  date: { type: String, required: true }, // e.g., '2025-08-22'
  amount: { type: Number, required: true },
  status: { type: String, default: 'Pending' }, // 'Pending', 'Paid', 'Rejected'
  downloadUrl: { type: String },
  // Add more fields as needed
});

const Payslip = mongoose.model('Payslip', PayslipSchema);
export default Payslip;

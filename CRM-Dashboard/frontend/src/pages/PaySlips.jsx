import { useState, useEffect } from "react";
import { Calendar, Receipt, Download, ReceiptIndianRupee, Check, X } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIndianRupee } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const PaySlips = () => {
  const [salary, setSalary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dynamicPayslips, setDynamicPayslips] = useState([]);
  const { user } = useAuth();
  const loggedInUserId = user?.employeeId;
  const isHR = user?.role === "HR";

  // Download handler
  const handleDownload = (payslip) => {
    const link = document.createElement("a");
    link.href = payslip.downloadUrl || `/sample-payslip.pdf`;
    link.download = `${payslip.month}-Payslip.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch payslips
  const fetchPayslips = async () => {
    try {
      const payslipRes = await axios.get(
        `http://localhost:5000/api/salary/user/${loggedInUserId}`
      );

      // ✅ Sort payslips by paymentDate or createdAt
      const sorted = payslipRes.data.sort(
        (a, b) =>
          new Date(b.paymentDate || b.createdAt) -
          new Date(a.paymentDate || a.createdAt)
      );

      setDynamicPayslips(sorted);

      // ✅ Set latest payslip as salary
      if (sorted.length > 0) {
        setSalary(sorted[0]);
      }
    } catch (err2) {
      if (err2.response && err2.response.status === 404) {
        setDynamicPayslips([]);
      } else {
        setError(err2.response?.data?.error || "Error fetching payslips data");
      }
    }
  };

  useEffect(() => {
    if (!loggedInUserId) {
      setError("No employeeId found. Please log in again.");
      return;
    }
    setLoading(true);
    fetchPayslips().finally(() => setLoading(false));
  }, [loggedInUserId]);

  if (loading) return <div className="p-5">Loading...</div>;
  if (error) return <div className="p-5 text-red-600">{error}</div>;

  return (
    <div className="p-5 bg-gray-50 space-y-8 pl-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-gray-500 text-1xl font-bold mb-4 uppercase">
          Payslips & Salary
        </h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white shadow-md hover:shadow-lg transition">
          <p className="text-sm text-gray-500">Basic Pay</p>
          <h3 className="text-xl font-bold text-green-700">
            <FontAwesomeIcon icon={faIndianRupee} /> {salary.basicPay || 0}
          </h3>
        </div>
        <div className="p-4 bg-white shadow-md hover:shadow-lg transition">
          <p className="text-sm text-gray-500">Allowances</p>
          <h3 className="text-xl font-bold text-blue-700">
            <FontAwesomeIcon icon={faIndianRupee} />{" "}
            {salary.allowances && typeof salary.allowances === "object"
              ? Object.values(salary.allowances).reduce(
                  (sum, val) => sum + Number(val || 0),
                  0
                )
              : salary.allowances || 0}
          </h3>
        </div>
        <div className="p-4 bg-white shadow-md hover:shadow-lg transition">
          <p className="text-sm text-gray-500">Deductions</p>
          <h3 className="text-xl font-bold text-red-700">
            <FontAwesomeIcon icon={faIndianRupee} />{" "}
            {salary.deductions && typeof salary.deductions === "object"
              ? Object.values(salary.deductions).reduce(
                  (sum, val) => sum + Number(val || 0),
                  0
                )
              : salary.deductions || 0}
          </h3>
        </div>
        <div className="p-4 bg-white shadow-md hover:shadow-lg transition">
          <p className="text-sm text-gray-500">Net Salary</p>
          <h3 className="text-xl font-bold text-purple-700">
            <FontAwesomeIcon icon={faIndianRupee} /> {salary.netPay || 0}
          </h3>
        </div>
      </div>

      {/* Payslip History */}
      <div className="bg-white shadow-md rounded-lg shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
          <Calendar className="h-5 w-5" /> Payslips History
        </h2>

        {dynamicPayslips.length === 0 ? (
          <p className="text-gray-500">No payslips found.</p>
        ) : (
          dynamicPayslips.slice(0, 3).map((p, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center border border-gray-300 rounded-md p-4 hover:border-blue-300 hover:shadow-sm transition duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-md">
                  <Receipt className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {p.month} {p.year}
                  </p>
                  <p className="text-sm text-gray-500">
                    Generated on{" "}
                    {p.paymentDate
                      ? new Date(p.paymentDate).toLocaleDateString()
                      : new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                    p.status === "Paid"
                      ? "bg-green-100 text-green-700"
                      : p.status === "Rejected"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {p.status || "Pending"}
                </span>
                <span className="font-semibold text-gray-700">
                  <FontAwesomeIcon icon={faIndianRupee} /> {p.netPay || 0}
                </span>

                {isHR && (
                  <>
                    <button
                      className="text-sm px-2 py-1 hover:bg-green-50 flex items-center gap-1"
                      onClick={async () => {
                        await axios.patch(
                          `http://localhost:5000/api/salary/${p._id}/status`,
                          { status: "Paid" }
                        );
                        fetchPayslips();
                      }}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </button>
                    <button
                      className="text-sm px-2 py-1 hover:bg-red-50 flex items-center gap-1"
                      onClick={async () => {
                        await axios.patch(
                          `http://localhost:5000/api/salary/${p._id}/status`,
                          { status: "Rejected" }
                        );
                        fetchPayslips();
                      }}
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </button>
                  </>
                )}

                <button
                  className="text-sm px-3 py-1 hover:bg-blue-50 flex items-center gap-1"
                  onClick={() => handleDownload(p)}
                >
                  <Download className="h-4 w-4 hover:h-6 hover:w-6 transition-all duration-300 cursor-pointer" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white shadow-md border-2 border-gray-200 rounded-lg p-6 space-y-4 mt-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
          <ReceiptIndianRupee className="h-5 w-5" /> Current Month Breakdown
        </h2>

        {/* Basic Pay */}
        <div className="flex justify-between text-sm text-gray-700">
          <span>Base Salary</span>
          <span className="text-green-600">
            + <FontAwesomeIcon icon={faIndianRupee} /> {salary.basicPay || 0}
          </span>
        </div>

        {/* Allowances */}
        {salary.allowances &&
          typeof salary.allowances === "object" &&
          Object.entries(salary.allowances).map(([key, value]) => {
            let label = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) =>
              str.toUpperCase()
            );
            if (key.toLowerCase().includes("housing"))
              label = "Housing Rent Allowance (HRA)";
            if (key.toLowerCase().includes("medical"))
              label = "Medical Allowance";
            return (
              <div
                key={key}
                className="flex justify-between text-sm text-gray-700"
              >
                <span>{label}</span>
                <span className="text-green-600">
                  + <FontAwesomeIcon icon={faIndianRupee} /> {Number(value) || 0}
                </span>
              </div>
            );
          })}

        {/* Deductions */}
        {salary.deductions &&
          typeof salary.deductions === "object" &&
          Object.entries(salary.deductions).map(([key, value]) => {
            let label = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) =>
              str.toUpperCase()
            );
            if (key.toLowerCase().includes("provident"))
              label = "Provident Fund (PF)";
            if (key.toLowerCase().includes("income")) label = "Income Tax";
            if (
              key.toLowerCase().includes("insurance") ||
              key.toLowerCase().includes("esi")
            )
              label = "Employee State Insurance (ESI)";
            return (
              <div
                key={key}
                className="flex justify-between text-sm text-gray-700"
              >
                <span>{label}</span>
                <span className="text-red-600">
                  - <FontAwesomeIcon icon={faIndianRupee} /> {Number(value) || 0}
                </span>
              </div>
            );
          })}

        {/* Net Salary */}
        <div className="border-t pt-3 mt-3 flex justify-between items-center font-semibold text-purple-800">
          <span>Net Salary</span>
          <span className="text-lg text-primary">
            <FontAwesomeIcon icon={faIndianRupee} /> {salary.netPay || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PaySlips;

import { faQuestionCircle } from '@fortawesome/free-regular-svg-icons';
import { faBug } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { faqs } from '../data'; 
import { HelpCircle, HelpingHand } from 'lucide-react';
import RaiseTicket from '../components/RiseTicket';
import HelpSupport from '../components/HelpSupport';

const Report = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false); // separate
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const handleTicketSubmit = (ticketData) => {
    console.log("Ticket Created:", ticketData);
    // Here you can call API: axios.post("/api/tickets", ticketData)
  };

  const handleSupportSubmit = (supportData) => {
    console.log("Support Request Created:", supportData);
    // Here you can call API: axios.post("/api/support", supportData)
  };

  const toggleFAQ = (index) => {
    setOpenIndex(index === openIndex ? null : index);
  };

  return (
    <div className="min-h-screen px-8 py-10">
      <h1 className="text-2xl font-bold text-center mb-10 text-gray-800">
        Support & Issue Center
        <HelpingHand className="w-12 h-12 inline-block pl-2"/>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Raise Ticket */}
        <div className="bg-gray-900 text-white rounded-lg shadow-lg p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-4">
              <FontAwesomeIcon icon={faBug} className="text-red-400 text-3xl" />
              Raise a Ticket
            </h2>
            <p className="text-gray-300 mb-6">
              Encountered a bug or issue? Submit a detailed report so our team can assist you.
            </p>
          </div>
          <button
             onClick={() => setIsTicketModalOpen(true)}
            className="text-center bg-white text-gray-900 border-2 border-black font-semibold py-2 rounded hover:bg-blue-700 hover:text-white transition"
          >
            Visit
          </button>
        </div>

        {/* Raise Ticket Modal */}
        <RaiseTicket
          isOpen={isTicketModalOpen}
          onClose={() => setIsTicketModalOpen(false)}
          onSubmit={handleTicketSubmit}
        />

        {/* Help & Support */}
        <div className="bg-gray-900 text-white rounded-lg shadow-lg p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-4">
              <FontAwesomeIcon icon={faQuestionCircle} className="text-yellow-400 text-3xl" />
              Help & Support
            </h2>
            <p className="text-gray-300 mb-6">
              Need assistance? Access helpful documentation and get answers to common questions.
            </p>
          </div>
          <button
            onClick={() => setIsSupportModalOpen(true)}
            className="text-center bg-white text-gray-900 border-2 border-black font-semibold py-2 rounded hover:bg-blue-700 hover:text-white transition"
          >
            Visit
          </button>
        </div>
      </div>
      {/* Help & Support Modal */}
        <HelpSupport
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          onSubmit={handleSupportSubmit}
        />

      {/* FAQ / Q&A Section */}
      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-xl font-bold  mb-6 text-gray-800">
          <HelpCircle className="w-6 h-16 pb-2 inline-block mr-5" />
          Frequently Asked Questions :</h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white border border-gray-300 rounded-lg shadow">
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full text-left px-6 py-4 font-semibold text-gray-800 flex justify-between items-center"
              >
                {faq.question}
                <span className="text-lg">{openIndex === index ? '-' : '+'}</span>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 text-gray-600">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Report;

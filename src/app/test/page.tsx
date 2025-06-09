export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          FOS Complaints Tracker
        </h1>
        <p className="text-gray-600 mb-8">
          Financial Ombudsman Service Complaints Analytics Dashboard
        </p>
        <div className="space-x-4">
          <a 
            href="/test" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Database Test
          </a>
          <a 
            href="#" 
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Dashboard (Coming Soon)
          </a>
        </div>
      </div>
    </div>
  );
}
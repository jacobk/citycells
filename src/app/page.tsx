'use client';

import Map from '@/components/Map';
import { useStrava } from '@/hooks/useStrava';

export default function Home() {
  const { athlete, activities, loading, login, logout } = useStrava();

  return (
    <main className="min-h-screen relative overflow-hidden">
      <Map activities={activities} />
      
      {/* Overlay UI */}
      <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg w-72 border border-gray-100">
        <h1 className="font-bold text-xl text-gray-800 mb-1">CityCells: Malmö</h1>
        
        {loading ? (
          <div className="text-sm text-gray-500 animate-pulse">Checking Strava...</div>
        ) : athlete ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src={athlete.profile} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{athlete.firstname} {athlete.lastname}</p>
                <p className="text-xs text-green-600 font-medium">{activities.length} Walks Found</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1 flex justify-between">
                <span>Progress</span>
                <span>0 / 136</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>

            <button 
              onClick={logout}
              className="w-full bg-gray-100 text-gray-600 py-2 px-4 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              Track your mission to walk around every sub-area of Malmö.
            </p>
            <button 
              onClick={login}
              className="w-full bg-[#fc4c02] text-white py-2.5 px-4 rounded-lg font-bold text-sm hover:bg-[#e34402] transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              Connect with Strava
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

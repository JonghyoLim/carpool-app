import React, { useState, useEffect } from 'react';
import { User, Calendar, CheckCircle, Plus, Loader } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

// Firebase config using environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function CarpoolScheduler() {
  const [parentName, setParentName] = useState('');
  const [selections, setSelections] = useState([]);
  const [currentDay, setCurrentDay] = useState('');
  const [currentSlots, setCurrentSlots] = useState({ dropOff: false, pickUp: false });
  const [loading, setLoading] = useState(true);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Listen to real-time updates from Firebase
  useEffect(() => {
    const q = query(collection(db, 'carpoolSelections'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSelections(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddSelection = async () => {
    if (parentName.trim() && currentDay && (currentSlots.dropOff || currentSlots.pickUp)) {
      try {
        await addDoc(collection(db, 'carpoolSelections'), {
          parent: parentName.trim(),
          day: currentDay,
          dropOff: currentSlots.dropOff,
          pickUp: currentSlots.pickUp,
          timestamp: new Date()
        });
        
        setCurrentDay('');
        setCurrentSlots({ dropOff: false, pickUp: false });
      } catch (error) {
        console.error('Error adding selection:', error);
        alert('Failed to add selection. Please try again.');
      }
    }
  };

  const handleRemoveSelection = async (id) => {
    try {
      await deleteDoc(doc(db, 'carpoolSelections', id));
    } catch (error) {
      console.error('Error removing selection:', error);
      alert('Failed to remove selection. Please try again.');
    }
  };

  const generateSchedule = () => {
    const schedule = {};
    days.forEach(day => {
      schedule[day] = { dropOff: '', pickUp: '' };
    });

    selections.forEach(selection => {
      if (selection.dropOff) {
        schedule[selection.day].dropOff = selection.parent;
      }
      if (selection.pickUp) {
        schedule[selection.day].pickUp = selection.parent;
      }
    });

    return schedule;
  };

  const schedule = generateSchedule();
  const mySelections = selections.filter(sel => sel.parent === parentName.trim());

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-indigo-600">
          <Loader className="animate-spin" size={24} />
          <span className="text-lg font-medium">Loading schedule...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Section 1: Parent Name */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-indigo-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-800">Weekly Carpool Schedule</h1>
          </div>
          
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Section 1: Your Name</h2>
          <input
            type="text"
            placeholder="Enter your first name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-lg"
          />
        </div>

        {/* Section 2: Pick Slots */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Section 2: Pick Your Slots</h2>
          
          {!parentName.trim() && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm">Please enter your name first</p>
            </div>
          )}

          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Day</label>
              <select
                value={currentDay}
                onChange={(e) => setCurrentDay(e.target.value)}
                disabled={!parentName.trim()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select day</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slots</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentSlots.dropOff}
                    onChange={(e) => setCurrentSlots({...currentSlots, dropOff: e.target.checked})}
                    disabled={!parentName.trim()}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-700 font-medium">Drop Off</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentSlots.pickUp}
                    onChange={(e) => setCurrentSlots({...currentSlots, pickUp: e.target.checked})}
                    disabled={!parentName.trim()}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-700 font-medium">Pick Up</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleAddSelection}
              disabled={!parentName.trim() || !currentDay || (!currentSlots.dropOff && !currentSlots.pickUp)}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Plus size={20} />
              Add to Schedule
            </button>
          </div>

          {mySelections.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Selections:</h3>
              <div className="space-y-2">
                {mySelections.map((sel) => (
                  <div key={sel.id} className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <span className="text-sm text-gray-700">
                      <strong>{sel.day}</strong>: {sel.dropOff && 'Drop Off'}{sel.dropOff && sel.pickUp && ' & '}{sel.pickUp && 'Pick Up'}
                    </span>
                    <button
                      onClick={() => handleRemoveSelection(sel.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium px-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Generated Schedule */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-indigo-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-700">Section 3: Weekly Schedule (All Parents)</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-indigo-600 text-white">
                  <th className="px-4 py-3 text-left rounded-tl-lg">Day</th>
                  <th className="px-4 py-3 text-left">Drop Off</th>
                  <th className="px-4 py-3 text-left rounded-tr-lg">Pick Up</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day, index) => (
                  <tr key={day} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-3 font-medium text-gray-700">{day}</td>
                    <td className="px-4 py-3">
                      {schedule[day].dropOff ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          <CheckCircle size={16} />
                          {schedule[day].dropOff}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Available</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {schedule[day].pickUp ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          <CheckCircle size={16} />
                          {schedule[day].pickUp}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
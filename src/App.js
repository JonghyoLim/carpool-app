import React, { useState, useEffect } from 'react';
import { User, Calendar, CheckCircle, Plus, Loader, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

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

const PARENT_NAMES = ['Claudia & JH', 'Iwona', 'Patricia & Lucasz'];

export default function CarpoolScheduler() {
  const [selectedParent, setSelectedParent] = useState('');
  const [selections, setSelections] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [daySlots, setDaySlots] = useState({});
  const [loading, setLoading] = useState(true);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Listen to real-time updates from Firebase
  useEffect(() => {
    const selectionsQuery = query(collection(db, 'carpoolSelections'), orderBy('timestamp', 'desc'));
    const holidaysQuery = query(collection(db, 'schoolHolidays'));
    
    const unsubscribeSelections = onSnapshot(selectionsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSelections(data);
      setLoading(false);
    });

    const unsubscribeHolidays = onSnapshot(holidaysQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHolidays(data);
    });

    return () => {
      unsubscribeSelections();
      unsubscribeHolidays();
    };
  }, []);

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      // Remove day
      setSelectedDays(prev => prev.filter(d => d !== day));
      const newSlots = { ...daySlots };
      delete newSlots[day];
      setDaySlots(newSlots);
    } else {
      // Add day
      setSelectedDays(prev => [...prev, day]);
      setDaySlots(prev => ({
        ...prev,
        [day]: { dropOff: false, pickUp: false }
      }));
    }
  };

  const updateDaySlot = (day, slot, value) => {
    setDaySlots(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [slot]: value
      }
    }));
  };

  const handleAddSelections = async () => {
    if (selectedParent && selectedDays.length > 0) {
      try {
        const batch = writeBatch(db);
        
        selectedDays.forEach(day => {
          const slots = daySlots[day];
          if (slots && (slots.dropOff || slots.pickUp)) {
            const docRef = doc(collection(db, 'carpoolSelections'));
            batch.set(docRef, {
              parent: selectedParent,
              day: day,
              dropOff: slots.dropOff,
              pickUp: slots.pickUp,
              timestamp: new Date()
            });
          }
        });
        
        await batch.commit();
        
        setSelectedDays([]);
        setDaySlots({});
      } catch (error) {
        console.error('Error adding selections:', error);
        alert('Failed to add selections. Please try again.');
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

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear ALL selections for this week?')) {
      try {
        const batch = writeBatch(db);
        selections.forEach(sel => {
          batch.delete(doc(db, 'carpoolSelections', sel.id));
        });
        await batch.commit();
      } catch (error) {
        console.error('Error clearing selections:', error);
        alert('Failed to clear selections. Please try again.');
      }
    }
  };

  const toggleHoliday = async (day) => {
    const existingHoliday = holidays.find(h => h.day === day);
    
    try {
      if (existingHoliday) {
        await deleteDoc(doc(db, 'schoolHolidays', existingHoliday.id));
      } else {
        await addDoc(collection(db, 'schoolHolidays'), {
          day: day,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error toggling holiday:', error);
      alert('Failed to update holiday. Please try again.');
    }
  };

  const isHoliday = (day) => holidays.some(h => h.day === day);

  const generateSchedule = () => {
    const schedule = {};
    days.forEach(day => {
      schedule[day] = { dropOff: '', pickUp: '', isHoliday: isHoliday(day) };
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
  const mySelections = selections.filter(sel => sel.parent === selectedParent);

  const hasAnySlotSelected = selectedDays.some(day => {
    const slots = daySlots[day];
    return slots && (slots.dropOff || slots.pickUp);
  });

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
        {/* Section 1: Select Parent */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-indigo-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-800">Weekly Carpool Schedule</h1>
          </div>
          
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Section 1: Select Your Name</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PARENT_NAMES.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedParent(name)}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  selectedParent === name
                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Pick Multiple Days & Individual Slots */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Section 2: Pick Your Days & Slots</h2>
          
          {!selectedParent && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm">Please select your name first</p>
            </div>
          )}

          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Days</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {days.map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    disabled={!selectedParent || isHoliday(day)}
                    className={`px-3 py-2 rounded-lg font-medium transition-all ${
                      selectedDays.includes(day)
                        ? 'bg-indigo-600 text-white'
                        : isHoliday(day)
                        ? 'bg-red-100 text-red-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:cursor-not-allowed`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {selectedDays.length > 0 && (
              <div className="space-y-3 mt-4">
                <label className="block text-sm font-medium text-gray-700">Pick slots for each day:</label>
                {selectedDays.map(day => (
                  <div key={day} className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <div className="font-semibold text-gray-800 mb-2">{day}</div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={daySlots[day]?.dropOff || false}
                          onChange={(e) => updateDaySlot(day, 'dropOff', e.target.checked)}
                          className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-gray-700 font-medium">Drop Off</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={daySlots[day]?.pickUp || false}
                          onChange={(e) => updateDaySlot(day, 'pickUp', e.target.checked)}
                          className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-gray-700 font-medium">Pick Up</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleAddSelections}
              disabled={!selectedParent || selectedDays.length === 0 || !hasAnySlotSelected}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Plus size={20} />
              Add to Schedule
            </button>
          </div>

          {mySelections.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Current Selections:</h3>
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

        {/* Holiday Management */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Mark School Holidays</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {days.map(day => (
              <button
                key={day}
                onClick={() => toggleHoliday(day)}
                className={`px-3 py-2 rounded-lg font-medium transition-all ${
                  isHoliday(day)
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isHoliday(day) && '🏖️ '}{day}
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Generated Schedule */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="text-indigo-600" size={24} />
              <h2 className="text-lg font-semibold text-gray-700">Section 3: Weekly Schedule (All Parents)</h2>
            </div>
            {selectedParent === 'Claudia & JH' && selections.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            )}
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
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {schedule[day].isHoliday && '🏖️ '}{day}
                      {schedule[day].isHoliday && <span className="ml-2 text-xs text-red-600 font-semibold">HOLIDAY</span>}
                    </td>
                    <td className="px-4 py-3">
                      {schedule[day].isHoliday ? (
                        <span className="text-red-500 text-sm">School Off</span>
                      ) : schedule[day].dropOff ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          <CheckCircle size={16} />
                          {schedule[day].dropOff}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Available</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {schedule[day].isHoliday ? (
                        <span className="text-red-500 text-sm">School Off</span>
                      ) : schedule[day].pickUp ? (
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
import React, { useState, useEffect } from 'react';
import { User, Calendar, CheckCircle, Plus, Loader, Trash2, Bell, X, AlertCircle, Check, Info } from 'lucide-react';
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

const PARENT_NAMES = ['Claudia', 'Iwona', 'Patricja', 'Łukasz', 'Jonghyo'];

const PARENT_COLORS = {
  'Claudia': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  'Iwona': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  'Patricja': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'Łukasz': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'Jonghyo': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' }
};

// Toast Notification Component
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-800',
      icon: <Check size={20} className="text-green-500" />
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-800',
      icon: <AlertCircle size={20} className="text-red-500" />
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-800',
      icon: <Info size={20} className="text-blue-500" />
    }
  };

  const style = styles[type] || styles.success;

  return (
    <div className={`${style.bg} ${style.text} border-l-4 ${style.border} p-4 rounded-lg shadow-lg flex items-start gap-3 min-w-[300px] max-w-md animate-slide-in`}>
      {style.icon}
      <p className="flex-1 font-medium">{message}</p>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <X size={18} />
      </button>
    </div>
  );
}

// Confirmation Dialog Component
function ConfirmDialog({ message, onConfirm, onCancel, type = 'danger' }) {
  const typeStyles = {
    danger: {
      bg: 'bg-red-100',
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      bg: 'bg-orange-100',
      icon: 'text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700'
    }
  };

  const styles = typeStyles[type] || typeStyles.danger;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${styles.bg}`}>
            <AlertCircle className={styles.icon} size={24} />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Confirm Action</h3>
        </div>
        
        <p className="text-gray-700 mb-6 whitespace-pre-line">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium text-white ${styles.button}`}
          >
            {type === 'warning' ? 'Take Over' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CarpoolScheduler() {
  const [selectedParent, setSelectedParent] = useState('');
  const [selections, setSelections] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [daySlots, setDaySlots] = useState({});
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [previousSelectionsCount, setPreviousSelectionsCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  // Day abbreviations for display
  const dayAbbrev = {
    'Monday': 'Mon',
    'Tuesday': 'Tue',
    'Wednesday': 'Wed',
    'Thursday': 'Thu',
    'Friday': 'Fri'
  };

  // Toast management
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Confirmation dialog management
  const showConfirmDialog = (message, onConfirm, type = 'danger') => {
    return new Promise((resolve) => {
      setConfirmDialog({
        message,
        onConfirm: () => {
          onConfirm();
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        },
        type
      });
    });
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        showNotification('Notifications Enabled! 🔔', 'You will now receive schedule updates');
        addToast('Notifications enabled successfully!', 'success');
        localStorage.setItem('notificationsEnabled', 'true');
      } else {
        addToast('Notifications permission denied', 'error');
      }
    }
  };

  // Show browser notification
  const showNotification = (title, body) => {
    if (notificationsEnabled && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'carpool-notification'
      });
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved === 'true') {
      setNotificationsEnabled(true);
    }
  }, []);

  useEffect(() => {
    const selectionsQuery = query(collection(db, 'carpoolSelections'), orderBy('timestamp', 'desc'));
    const holidaysQuery = query(collection(db, 'schoolHolidays'));
    
    const unsubscribeSelections = onSnapshot(selectionsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (!loading && data.length !== previousSelectionsCount) {
        if (data.length > previousSelectionsCount) {
          const latestSelection = data[0];
          if (latestSelection && latestSelection.parent !== selectedParent) {
            const slots = [];
            if (latestSelection.dropOff) slots.push('Drop Off');
            if (latestSelection.pickUp) slots.push('Pick Up');
            showNotification(
              '📅 Schedule Updated!',
              `${latestSelection.parent} added ${latestSelection.day} ${slots.join(' & ')}`
            );
          }
        } else if (data.length < previousSelectionsCount) {
          showNotification(
            '🗑️ Schedule Updated',
            'A carpool slot was removed'
          );
        }
      }
      
      setSelections(data);
      setPreviousSelectionsCount(data.length);
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
  }, [loading, previousSelectionsCount, selectedParent]);

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(prev => prev.filter(d => d !== day));
      const newSlots = { ...daySlots };
      delete newSlots[day];
      setDaySlots(newSlots);
    } else {
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

  const handleShowConfirmation = () => {
    setShowConfirmation(true);
  };

  const handleConfirmAddSelections = async () => {
    if (selectedParent && selectedDays.length > 0) {
      let hasError = false;
      
      try {
        // Check for conflicts
        const conflicts = [];
        selectedDays.forEach(day => {
          const slots = daySlots[day];
          if (slots) {
            if (slots.dropOff && schedule[day].dropOff && schedule[day].dropOff !== selectedParent) {
              conflicts.push(`${day} Drop Off (currently assigned to ${schedule[day].dropOff})`);
            }
            if (slots.pickUp && schedule[day].pickUp && schedule[day].pickUp !== selectedParent) {
              conflicts.push(`${day} Pick Up (currently assigned to ${schedule[day].pickUp})`);
            }
          }
        });

        // If there are conflicts, close the first modal and show conflict dialog
        if (conflicts.length > 0) {
          setShowConfirmation(false);
          
          setTimeout(() => {
            showConfirmDialog(
              `The following slots are already taken:\n\n${conflicts.join('\n')}\n\nDo you want to take over these slots?`,
              async () => {
                await addSelectionsToFirebase(true);
              },
              'warning'
            );
          }, 100);
          return;
        }

        // No conflicts, proceed normally
        await addSelectionsToFirebase(false);
        
      } catch (error) {
        hasError = true;
        console.error('Error adding selections:', error);
        addToast('Failed to add selections. Please try again.', 'error');
      }
    }
  };

  const addSelectionsToFirebase = async (removeConflicts) => {
    let operationSuccessful = false;
    
    try {
      const batch = writeBatch(db);
      
      // If removing conflicts, delete existing assignments for these slots
      if (removeConflicts) {
        selectedDays.forEach(day => {
          const slots = daySlots[day];
          if (slots) {
            // Find and remove conflicting selections
            selections.forEach(sel => {
              if (sel.day === day) {
                if ((slots.dropOff && sel.dropOff && sel.parent !== selectedParent) ||
                    (slots.pickUp && sel.pickUp && sel.parent !== selectedParent)) {
                  batch.delete(doc(db, 'carpoolSelections', sel.id));
                }
              }
            });
          }
        });
      }
      
      // Add new selections
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
      
      // Commit the batch
      await batch.commit();
      operationSuccessful = true;
      
      // Clear selections
      setSelectedDays([]);
      setDaySlots({});
      setShowConfirmation(false);
      
      // Show success messages
      addToast('✅ Your carpool slots have been added to the schedule!', 'success');
      showNotification('✅ Added to Schedule!', 'Your carpool slots have been saved');
      
    } catch (error) {
      console.error('Error in addSelectionsToFirebase:', error);
      
      // Only show error if operation actually failed
      if (!operationSuccessful) {
        addToast('Failed to add selections. Please try again.', 'error');
      }
    }
  };

  const handleRemoveSelection = async (id) => {
    let operationSuccessful = false;
    
    try {
      await deleteDoc(doc(db, 'carpoolSelections', id));
      operationSuccessful = true;
      
      addToast('🗑️ Carpool slot removed successfully', 'success');
      showNotification('🗑️ Removed', 'Your carpool slot has been removed');
    } catch (error) {
      console.error('Error removing selection:', error);
      
      // Only show error if operation actually failed
      if (!operationSuccessful) {
        addToast('Failed to remove selection. Please try again.', 'error');
      }
    }
  };

  const handleClearAll = async () => {
    showConfirmDialog(
      'Are you sure you want to clear ALL selections for this week? This action cannot be undone.',
      async () => {
        let operationSuccessful = false;
        
        try {
          const batch = writeBatch(db);
          selections.forEach(sel => {
            batch.delete(doc(db, 'carpoolSelections', sel.id));
          });
          
          await batch.commit();
          operationSuccessful = true;
          
          addToast('🗑️ All selections cleared successfully', 'success');
          showNotification('🗑️ All Cleared', 'All carpool selections have been cleared');
        } catch (error) {
          console.error('Error clearing selections:', error);
          
          // Only show error if operation actually failed
          if (!operationSuccessful) {
            addToast('Failed to clear selections. Please try again.', 'error');
          }
        }
      }
    );
  };

  const toggleHoliday = async (day) => {
    const existingHoliday = holidays.find(h => h.day === day);
    let operationSuccessful = false;
    
    try {
      if (existingHoliday) {
        await deleteDoc(doc(db, 'schoolHolidays', existingHoliday.id));
        operationSuccessful = true;
        
        addToast(`📅 ${day} is no longer marked as a holiday`, 'info');
        showNotification('📅 Holiday Removed', `${day} is no longer a holiday`);
      } else {
        await addDoc(collection(db, 'schoolHolidays'), {
          day: day,
          timestamp: new Date()
        });
        operationSuccessful = true;
        
        addToast(`🏖️ ${day} marked as a school holiday`, 'info');
        showNotification('🏖️ Holiday Added', `${day} is now marked as a holiday`);
      }
    } catch (error) {
      console.error('Error toggling holiday:', error);
      
      // Only show error if operation actually failed
      if (!operationSuccessful) {
        addToast('Failed to update holiday. Please try again.', 'error');
      }
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

  const getPreviewText = () => {
    const previews = [];
    selectedDays.forEach(day => {
      const slots = daySlots[day];
      if (slots && (slots.dropOff || slots.pickUp)) {
        const slotTexts = [];
        if (slots.dropOff) slotTexts.push('Drop Off');
        if (slots.pickUp) slotTexts.push('Pick Up');
        previews.push(`${day}: ${slotTexts.join(' & ')}`);
      }
    });
    return previews;
  };

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
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
          type={confirmDialog.type}
        />
      )}

      <div className="max-w-4xl mx-auto">
        {/* Notification Banner */}
        {!notificationsEnabled && 'Notification' in window && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="text-yellow-600" size={24} />
              <div>
                <p className="font-semibold text-yellow-800">Enable Notifications</p>
                <p className="text-sm text-yellow-700">Get notified when the schedule changes</p>
              </div>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              Enable
            </button>
          </div>
        )}

        {/* Select Parent */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-indigo-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-800">Weekly Carpool Schedule</h1>
          </div>
          
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Select Your Name</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PARENT_NAMES.map((name) => {
              const colors = PARENT_COLORS[name];
              return (
                <button
                  key={name}
                  onClick={() => setSelectedParent(name)}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    selectedParent === name
                      ? `${colors.bg} ${colors.text} ${colors.border} shadow-lg scale-105`
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pick Multiple Days & Individual Slots */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Pick Your Days & Slots</h2>
          
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
              onClick={handleShowConfirmation}
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
                {mySelections.map((sel) => {
                  const colors = PARENT_COLORS[sel.parent];
                  return (
                    <div key={sel.id} className={`flex items-center justify-between ${colors.bg} p-3 rounded-lg border ${colors.border}`}>
                      <span className={`text-sm ${colors.text} font-medium`}>
                        <strong>{sel.day}</strong>: {sel.dropOff && 'Drop Off'}{sel.dropOff && sel.pickUp && ' & '}{sel.pickUp && 'Pick Up'}
                      </span>
                      <button
                        onClick={() => handleRemoveSelection(sel.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium px-2"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Holiday Management - Only visible for Jonghyo and Claudia */}
        {(selectedParent === 'Jonghyo' || selectedParent === 'Claudia') && (
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
        )}

        {/*  Generated Schedule */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="text-indigo-600" size={24} />
              <h2 className="text-lg font-semibold text-gray-700">Weekly Schedule (All Parents)</h2>
            </div>
            {(selectedParent === 'Jonghyo' || selectedParent === 'Claudia') && selections.length > 0 && (
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
                      {schedule[day].isHoliday && '🏖️ '}{dayAbbrev[day]}
                      {schedule[day].isHoliday && <span className="ml-2 text-xs text-red-600 font-semibold">HOLIDAY</span>}
                    </td>
                    <td className="px-4 py-3">
                      {schedule[day].isHoliday ? (
                        <span className="text-red-500 text-sm">School Off</span>
                      ) : schedule[day].dropOff ? (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-medium ${PARENT_COLORS[schedule[day].dropOff]?.bg} ${PARENT_COLORS[schedule[day].dropOff]?.text}`}>
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
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-medium ${PARENT_COLORS[schedule[day].pickUp]?.bg} ${PARENT_COLORS[schedule[day].pickUp]?.text}`}>
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

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Confirm Your Selection</h3>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">You're about to add:</p>
              <div className={`${PARENT_COLORS[selectedParent]?.bg} ${PARENT_COLORS[selectedParent]?.text} p-4 rounded-lg border ${PARENT_COLORS[selectedParent]?.border}`}>
                <p className="font-semibold mb-2">👤 {selectedParent}</p>
                <ul className="space-y-1 text-sm">
                  {getPreviewText().map((text, index) => (
                    <li key={index}>✓ {text}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddSelections}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Confirm & Add
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
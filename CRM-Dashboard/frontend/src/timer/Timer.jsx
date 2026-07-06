import React, { useState, useEffect } from 'react';
import { CircleStop, Pause, PlayIcon, X } from 'lucide-react';
import TaskCard from '../components/TaskCard'; 

const Timer = ({
  isOpen,
  onClose,
  tasks = [],
  onAddTask,
  
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState(tasks[0]?.secondsElapsed || 0);
  const [isRunning, setIsRunning] = useState(tasks[0]?.isRunning || false);
  const [showTaskCard, setShowTaskCard] = useState(false);
  const [lastTimeTaken, setLastTimeTaken] = useState(null);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds) => {
    const safeSeconds = Number(seconds) || 0;
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(safeSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  };

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);

  const handleStop = () => {
    setIsRunning(false);
    const timeTaken = formatTime(secondsElapsed);
    setLastTimeTaken(timeTaken);
    setSecondsElapsed(0);
    setShowTaskCard(true); 
  };

  const handleSaveTask = (task, desc) => {
    console.log(`Saved Task: ${task}, Description: ${desc}, Time: ${lastTimeTaken}`);

    // Call parent's add task function if exists
    if (typeof onAddTask === 'function') {
      onAddTask({
        name: task,
        description: desc,
        timeTaken: lastTimeTaken
      });
    }
    setShowTaskCard(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed top-[70px] right-10 z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-[320px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Analog Timer</h2>
            <button
              onClick={onClose}
              className="text-red-600 hover:bg-red-100 p-2 rounded-full transition"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-md mb-4 text-blue-700">
            Time Taken: <strong>{formatTime(secondsElapsed)}</strong>
          </p>
          <div className="flex gap-2">
            {!isRunning ? (
              <button onClick={handleStart} className="p-2 rounded-full hover:bg-green-200 hover:text-green-600 transition duration-200 cursor-pointer">
                <PlayIcon className="w-5 h-5" />
              </button>
            ) : (
              <button onClick={handlePause} className="p-2 rounded-full hover:bg-yellow-200 hover:text-yellow-600 transition duration-200 cursor-pointer">
                <Pause className="w-5 h-5" />
              </button>
            )}
            <button onClick={handleStop} className="p-2 rounded-full hover:bg-red-200 hover:text-red-600 transition duration-200 cursor-pointer">
              <CircleStop className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      

      {lastTimeTaken && showTaskCard && (
        <TaskCard
          onClose={() => setShowTaskCard(false)}
          onSave={handleSaveTask}
          taskName={tasks[0]?.name}
          taskDesc={tasks[0]?.description}
          timeTaken={lastTimeTaken} 
        />
      )}
    </>
  );
};

export default Timer;

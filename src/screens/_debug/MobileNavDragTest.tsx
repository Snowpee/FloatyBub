import React from 'react';
import { NavProvider, NavContainer, NavLink, BackButton, useNav } from '../../components/navigation/MobileNav';

const TestPage: React.FC<{ title: string; pageNum: number }> = ({ title, pageNum }) => {
  const nav = useNav();
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="flex items-center justify-between p-4 bg-white shadow-sm">
        <BackButton className="btn btn-ghost btn-sm bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-lg">
          ← Back
        </BackButton>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <div className="w-16"></div>
      </div>
      
      <div className="flex-1 p-6 space-y-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Drag Gesture Test</h2>
          <p className="text-gray-600 mb-4">
            Try these interactions:
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Click the "← Back" button - should work on first click</li>
            <li>• Drag horizontally on the content area - should trigger swipe back</li>
            <li>• Try to drag starting on the button - should be ignored</li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-md font-semibold mb-4">Console Log Test</h3>
          <p className="text-gray-600 text-sm">
            Open browser console to see detailed interaction logs
          </p>
        </div>
        
        {pageNum < 3 && (
          <NavLink 
            component={TestPage} 
            props={{ title: `Test Page ${pageNum + 1}`, pageNum: pageNum + 1 }}
            className="btn btn-primary w-full"
          >
            Go to Page {pageNum + 1}
          </NavLink>
        )}
        
        {pageNum === 3 && (
          <button 
            onClick={() => nav.popToRoot()}
            className="btn btn-accent w-full"
          >
            Pop to Root
          </button>
        )}
      </div>
      
      <div className="p-4 bg-gray-100 text-center text-xs text-gray-500">
        Page {pageNum} of 3 - Drag horizontally to go back
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  const goBack = () => {
    if (window && window.history) window.history.back();
  };
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="flex items-center justify-between p-4">
        <button onClick={goBack} className="btn btn-ghost btn-sm bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-lg">← 返回</button>
        <h1 className="text-3xl font-bold text-gray-800">MobileNav Drag Test</h1>
        <div className="w-16" />
      </div>
      
      <div className="flex-1 p-6 space-y-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Test Instructions</h2>
          <p className="text-gray-600 mb-4">
            This test verifies that drag gestures and button clicks work correctly without interference.
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 rounded border-l-4 border-green-400">
              <p className="text-sm font-medium text-green-800">Expected Behavior:</p>
              <ul className="text-xs text-green-700 mt-2 space-y-1">
                <li>• Back button works on first click</li>
                <li>• Drag gestures work in content areas</li>
                <li>• No interference between gestures and clicks</li>
              </ul>
            </div>
            <div className="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
              <p className="text-sm font-medium text-blue-800">Test Steps:</p>
              <ol className="text-xs text-blue-700 mt-2 space-y-1">
                <li>1. Navigate to Test Page 1</li>
                <li>2. Click back button - should work immediately</li>
                <li>3. Navigate again and try drag gesture</li>
                <li>4. Try dragging from button area - should be ignored</li>
              </ol>
            </div>
          </div>
        </div>
        
        <NavLink 
          component={TestPage} 
          props={{ title: "Test Page 1", pageNum: 1 }}
          className="btn btn-primary w-full btn-lg"
        >
          Start Test →
        </NavLink>
      </div>
    </div>
  );
};

export default function MobileNavDragTest() {
  return (
    <div className="w-full h-screen pt-[env(safe-area-inset-top)]">
      <NavProvider root={HomePage}>
        <NavContainer animated swipeGesture iosSwipeStartMargin={0} />
      </NavProvider>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Monitor, Smartphone } from 'lucide-react';
const MobileRestrictedPage: React.FC = () => {
      const [deviceInfo, setDeviceInfo] = useState<{
        isMobile: boolean;
        userAgent: string;
        message: string;

  } | null>(null);
  useEffect(() => {
    const checkDevice = async () => {
       try {
         const response = await fetch('/api/device-check');
         const data = await response.json();
         setDeviceInfo(data);
       } catch (error) {
         console.error('Failed to check device:', error);
        //   Fallback client-side detection
         const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
         setDeviceInfo({
           isMobile,
           userAgent: navigator.userAgent,
           message: isMobile ? 'Mobile device detected' : 'Desktop device detected'
         });
       }
     };
     checkDevice();
   }, []);
   if (!deviceInfo?.isMobile) {
     return null;  // Don't show restriction if not mobile
   }
   return (
     <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
       <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
         {/* Icon */}
         <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
           <AlertTriangle className="w-8 h-8 text-red-600" />
         </div>
         {/* Title */}
         <h1 className="text-2xl font-bold text-gray-900 mb-4">
           Desktop Access Required
         </h1>
         {/* Message */}
         <p className="text-gray-600 mb-6 leading-relaxed">
           This Email Automation Platform is optimized for desktop use only. 
           Please access from a desktop or laptop computer for the best experience.
         </p>
         {/* Device Info */}
         <div className="bg-gray-50 rounded-lg p-4 mb-6">
           <div className="flex items-center justify-center mb-2">
             <Smartphone className="w-5 h-5 text-gray-500 mr-2" />
             <span className="text-sm font-medium text-gray-700">Current Device</span>
           </div>
           <p className="text-xs text-gray-500 break-all">
             {deviceInfo.message}
           </p>
         </div>
         {/* Recommended Action */}
         <div className="bg-blue-50 rounded-lg p-4 mb-6">
           <div className="flex items-center justify-center mb-2">
             <Monitor className="w-5 h-5 text-blue-600 mr-2" />
             <span className="text-sm font-medium text-blue-800">Recommended</span>
           </div>
           <p className="text-sm text-blue-700">
             Switch to a desktop or laptop computer to access all features
           </p>
         </div>
         {/* Features Available on Desktop */}
         <div className="text-left">
           <h3 className="font-semibold text-gray-900 mb-3">Available on Desktop:</h3>
           <ul className="space-y-2 text-sm text-gray-600">
             <li className="flex items-center">
               <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
               Full dashboard with analytics
             </li>
             <li className="flex items-center">
               <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
               Campaign management
             </li>
             <li className="flex items-center">
               <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
               Email template editor
             </li>
             <li className="flex items-center">
               <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
               Bulk email upload
             </li>
             <li className="flex items-center">
               <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
               Real-time notifications
             </li>
           </ul>
         </div>
         {/* Contact Info */}
         <div className="mt-8 pt-6 border-t border-gray-200">
           <p className="text-xs text-gray-500">
             Need help? Contact your administrator for desktop access guidance.
           </p>
         </div>
       </div>
     </div>
   );
 };
 export default MobileRestrictedPage;
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-sky-400 mb-4">
        <AlertCircle className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-white tracking-tight">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-400 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors shadow-lg shadow-sky-600/20"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Overview
      </Link>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Download, Loader2, X, Terminal, Server, Cpu } from 'lucide-react';
import { checkSystemCLIs, manageSystemCLI } from '../../lib/daemon';
import { cn } from '../../lib/cn';

export default function SetupWizard({ isOpen, onClose }) {
  const [clis, setClis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(null); // name of cli being installed
  const [error, setError] = useState(null);

  const fetchCLIs = async () => {
    try {
      setLoading(true);
      const data = await checkSystemCLIs();
      setClis(data || []);
      setError(null);
      
      // If all installed, mark as completed
      if (data && data.length > 0 && data.every(c => c.installed)) {
        localStorage.setItem('soupz_setup_completed', 'true');
      }
    } catch (err) {
      setError('Failed to check system CLIs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCLIs();
    }
  }, [isOpen]);

  const handleInstall = async (name) => {
    try {
      setInstalling(name);
      const res = await manageSystemCLI(name, 'install');
      if (res.success) {
        await fetchCLIs();
      } else {
        setError(res.output || `Failed to install ${name}`);
      }
    } catch (err) {
      setError(`Error installing ${name}: ${err.message}`);
    } finally {
      setInstalling(null);
    }
  };

  const allInstalled = clis.length > 0 && clis.every(c => c.installed);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Terminal className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">System Setup Wizard</h2>
                <p className="text-sm text-zinc-400">Ensure your machine is ready for Soupz</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm text-red-200">{error}</div>
              </div>
            )}

            <div className="space-y-4">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  <p className="text-zinc-400 text-sm">Checking system requirements...</p>
                </div>
              ) : (
                <>
                  {clis.map((cli) => (
                    <div
                      key={cli.name}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-200",
                        cli.installed 
                          ? "bg-zinc-800/30 border-zinc-700/50" 
                          : "bg-orange-500/5 border-orange-500/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-2.5 rounded-lg",
                            cli.installed ? "bg-zinc-800 text-zinc-400" : "bg-orange-500/10 text-orange-500"
                          )}>
                            {cli.name === 'git' ? <Server className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white capitalize">{cli.name}</span>
                              {cli.installed && (
                                <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider rounded-full border border-green-500/20">
                                  Ready
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {cli.installed 
                                ? `Version ${cli.version} installed` 
                                : `Required for ${cli.name === 'git' ? 'source control' : 'agent operations'}`
                              }
                            </p>
                          </div>
                        </div>

                        {cli.installed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <button
                            onClick={() => handleInstall(cli.name)}
                            disabled={!!installing}
                            className={cn(
                              "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all",
                              installing === cli.name
                                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                : "bg-orange-500 text-white hover:bg-orange-600 active:scale-95 shadow-lg shadow-orange-500/20"
                            )}
                          >
                            {installing === cli.name ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Installing...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                Install
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {clis.length === 0 && !loading && (
                    <div className="py-12 text-center">
                      <p className="text-zinc-500">No system requirements found.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-zinc-800/30 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-500 max-w-[300px]">
              Soupz needs these tools to interact with your local environment securely.
            </p>
            <button
              onClick={onClose}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-semibold transition-all",
                allInstalled
                  ? "bg-white text-black hover:bg-zinc-200"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              {allInstalled ? 'Get Started' : 'Skip for now'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

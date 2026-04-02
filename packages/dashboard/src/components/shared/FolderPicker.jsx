import { useState, useEffect } from 'react';
import {
  Folder, FolderOpen, ChevronLeft, GitBranch, X, Loader2,
  ArrowRight, Home, Plus, Github, Database, Check,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { listDirectories, initProject } from '../../lib/daemon';
import { OVERLAY_Z } from '../../lib/overlayZ.js';

export default function FolderPicker({ open, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Project Init Flow state
  const [step, setStep] = useState('list'); // 'list', 'naming', 'integrations'
  const [newProject, setNewProject] = useState({ name: '', supabase: false, github: false });
  const [isCreating, setIsCreating] = useState(false);

  async function loadDir(path) {
    setLoading(true);
    setError(null);
    try {
      const result = await listDirectories(path);
      if (result) {
        setData(result);
      } else {
        setError('Could not load directories. Is the daemon running?');
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handleCreateProject() {
    if (!newProject.name) return;
    setIsCreating(true);
    setError(null);
    try {
      const result = await initProject({
        name: newProject.name,
        path: data?.current,
        supabase: newProject.supabase,
        github: newProject.github
      });
      if (result && result.path) {
        onSelect(result.path);
        onClose();
        // Reset state for next time
        setStep('list');
        setNewProject({ name: '', supabase: false, github: false });
      }
    } catch (e) {
      setError(e.message);
    }
    setIsCreating(false);
  }

  useEffect(() => {
    if (open) {
      loadDir();
      setStep('list');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: OVERLAY_Z.folderPicker }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-bg-elevated border border-border-mid rounded-xl overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <FolderOpen size={16} className="text-accent" />
          <span className="text-sm font-ui font-medium text-text-pri flex-1">
            {step === 'list' ? 'Open Folder' : 'New Project'}
          </span>
          {step === 'list' && (
            <button
              onClick={() => setStep('naming')}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 text-[10px] font-medium transition-all"
            >
              <Plus size={12} /> New Project
            </button>
          )}
          <button onClick={onClose} className="text-text-faint hover:text-text-sec transition-colors">
            <X size={14} />
          </button>
        </div>

        {step === 'list' && (
           <>
             {/* Current path */}
             {data && (
               <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-bg-surface">
                 <button
                   onClick={() => loadDir(data.parent)}
                   className="text-text-faint hover:text-text-sec transition-colors"
                   title="Go up"
                 >
                   <ChevronLeft size={14} />
                 </button>
                 <button
                   onClick={() => loadDir()}
                   className="text-text-faint hover:text-text-sec transition-colors"
                   title="Home"
                 >
                   <Home size={12} />
                 </button>
                 <span className="text-xs font-mono text-text-sec truncate flex-1">{data.current}</span>
                 {data.isGitRepo && (
                   <span className="flex items-center gap-1 text-[10px] font-mono text-success border border-success/20 rounded px-1.5 py-0.5">
                     <GitBranch size={9} /> git
                   </span>
                 )}
               </div>
             )}

             {/* Directory list */}
             <div className="max-h-[320px] overflow-y-auto">
               {loading && (
                 <div className="flex items-center justify-center py-8">
                   <Loader2 size={16} className="text-text-faint animate-spin" />
                 </div>
               )}

               {error && (
                 <div className="p-4 text-center">
                   <p className="text-xs text-danger font-ui">{error}</p>
                 </div>
               )}

               {data && !loading && data.dirs.length === 0 && (
                 <div className="p-4 text-center">
                   <p className="text-xs text-text-faint font-ui">No subdirectories</p>
                 </div>
               )}

               {data && !loading && data.dirs.map(dir => (
                 <div
                   key={dir.path}
                   className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-overlay transition-colors cursor-pointer group border-b border-border-subtle last:border-0"
                 >
                   <button
                     onClick={() => loadDir(dir.path)}
                     className="flex items-center gap-3 flex-1 min-w-0 text-left"
                   >
                     <Folder size={14} className="text-warning shrink-0" />
                     <span className="text-xs font-ui text-text-pri truncate">{dir.name}</span>
                     {dir.isGitRepo && (
                       <span className="flex items-center gap-0.5 text-[9px] font-mono text-success/70 shrink-0">
                         <GitBranch size={8} />
                       </span>
                     )}
                   </button>
                   <button
                     onClick={() => { onSelect(dir.path); onClose(); }}
                     className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-ui text-accent px-2 py-1 rounded border border-accent/20 hover:bg-accent/10 transition-all shrink-0"
                   >
                     Open <ArrowRight size={9} />
                   </button>
                 </div>
               ))}
             </div>

             {/* Footer — open current folder */}
             {data && (
               <div className="px-4 py-3 border-t border-border-subtle bg-bg-surface">
                 <button
                   onClick={() => { onSelect(data.current); onClose(); }}
                   className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-ui font-medium transition-all"
                 >
                   <FolderOpen size={13} />
                   Open this folder
                 </button>
               </div>
             )}
           </>
        )}

        {step === 'naming' && (
          <div className="p-6">
            <label className="block text-xs font-ui font-medium text-text-sec mb-2">Folder Name</label>
            <input
              autoFocus
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="w-full bg-bg-surface border border-border-mid rounded-lg px-3 py-2 text-sm font-ui text-text-pri focus:outline-none focus:border-accent transition-colors"
              placeholder="my-cool-project"
              onKeyDown={(e) => e.key === 'Enter' && newProject.name && setStep('integrations')}
            />
            {error && <p className="mt-2 text-[10px] text-danger">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep('list')}
                className="flex-1 py-2 rounded-lg border border-border-mid text-text-sec text-xs font-ui font-medium hover:bg-bg-surface transition-all"
              >
                Cancel
              </button>
              <button
                disabled={!newProject.name}
                onClick={() => setStep('integrations')}
                className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-ui font-medium transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'integrations' && (
          <div className="p-6">
            <h3 className="text-xs font-ui font-medium text-text-pri mb-4">Add Integrations</h3>

            <div className="space-y-3">
              <button
                onClick={() => setNewProject({ ...newProject, github: !newProject.github })}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  newProject.github ? "bg-accent/5 border-accent" : "bg-bg-surface border-border-subtle hover:border-border-mid"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  newProject.github ? "bg-accent text-white" : "bg-bg-elevated text-text-faint"
                )}>
                  <Github size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-ui font-medium text-text-pri">Initialize Git</div>
                  <div className="text-[10px] text-text-faint">Start with a local repository</div>
                </div>
                {newProject.github && <Check size={14} className="text-accent" />}
              </button>

              <button
                onClick={() => setNewProject({ ...newProject, supabase: !newProject.supabase })}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  newProject.supabase ? "bg-success/5 border-success/50" : "bg-bg-surface border-border-subtle hover:border-border-mid"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  newProject.supabase ? "bg-success text-white" : "bg-bg-elevated text-text-faint"
                )}>
                  <Database size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-ui font-medium text-text-pri">Supabase</div>
                  <div className="text-[10px] text-text-faint">Setup database & auth schema</div>
                </div>
                {newProject.supabase && <Check size={14} className="text-success" />}
              </button>
            </div>

            {error && <p className="mt-4 text-[10px] text-danger">{error}</p>}

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setStep('naming')}
                className="py-2 px-4 rounded-lg border border-border-mid text-text-sec text-xs font-ui font-medium hover:bg-bg-surface transition-all"
              >
                Back
              </button>
              <button
                disabled={isCreating}
                onClick={handleCreateProject}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-ui font-medium transition-all"
              >
                {isCreating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

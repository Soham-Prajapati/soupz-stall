import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Menu, X, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { DOCS_DATA } from '../../data/docs-data';

export default function DocsPage({ navigate }) {
  const [activeItem, setActiveItem] = useState(DOCS_DATA[0].items[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    [DOCS_DATA[0].section]: true,
    [DOCS_DATA[1].section]: true
  });

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-300 font-ui overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`absolute lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950/80 backdrop-blur-md border-r border-slate-800/60 flex flex-col transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="mb-6 flex items-center justify-between lg:hidden text-slate-100">
            <h2 className="text-xl font-bold tracking-tight">Documentation</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-md transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <nav className="space-y-6">
            {DOCS_DATA.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-2">
                <button
                  onClick={() => toggleSection(group.section)}
                  className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-accent transition-colors group px-2"
                >
                  {group.section}
                  {expandedSections[group.section] ? (
                    <ChevronDown size={14} className="text-slate-500 group-hover:text-accent" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-500 group-hover:text-accent" />
                  )}
                </button>
                
                <AnimatePresence initial={false}>
                  {expandedSections[group.section] && (
                    <motion.ul 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-1 overflow-hidden"
                    >
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => {
                              setActiveItem(item);
                              setIsSidebarOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                              activeItem.id === item.id 
                                ? 'bg-accent/10 text-accent font-medium' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                          >
                            {activeItem.id === item.id && <ArrowRight size={14} className="text-accent shrink-0" />}
                            <span className={activeItem.id === item.id ? '' : 'pl-5'}>{item.title}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </nav>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 relative h-full">
        {/* Mobile Header Bar */}
        <header className="lg:hidden flex items-center h-14 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 px-4 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 mr-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-slate-200 truncate pr-4">{activeItem.title}</span>
        </header>

        {/* Markdown Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            <article className="prose prose-invert prose-slate prose-headings:font-bold prose-h1:text-4xl prose-h1:mb-8 prose-h1:tracking-tight prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:tracking-tight prose-h3:text-xl prose-p:text-slate-300 prose-p:leading-relaxed prose-a:text-accent hover:prose-a:text-accent/80 prose-code:text-accent prose-code:bg-accent/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium prose-code:rounded prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 w-full prose-li:text-slate-300 max-w-none break-words">
              <ReactMarkdown>{activeItem.content}</ReactMarkdown>
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}

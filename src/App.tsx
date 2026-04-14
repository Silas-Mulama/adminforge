import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Users, 
  Settings, 
  Plus, 
  LogOut,
  ChevronRight,
  BarChart3,
  ShieldCheck,
  FileCode,
  MoreVertical,
  Trash2,
  Pencil,
  Menu,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, hasSupabaseCredentials } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { parseSchema, generateDashboardConfig, generateSchemaFromDescription, reviewSchemaWithAi, validateSchemaConfig } from '@/src/lib/schema-engine';
import { SchemaConfig } from '@/src/types';
import { DashboardRenderer } from './components/DashboardRenderer';
import { AuthForm } from './components/AuthForm';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
  }
}

function handleDatabaseError(error: any, operationType: OperationType, path: string | null, user?: any, onError?: (err: any) => void) {
  const message = error?.message || (error instanceof Error ? error.message : String(error));
  const errInfo: DatabaseErrorInfo = {
    error: message,
    authInfo: {
      userId: user?.id || '',
      email: user?.email || '',
    },
    operationType,
    path
  }
  console.error('Database Error: ', JSON.stringify(errInfo));
  toast.error(`Database error: ${errInfo.error}`);
  if (onError) {
    onError(errInfo);
  } else {
    // Don't throw if we're just logging, to avoid crashing the UI
    console.error('Unhandled database error', errInfo);
  }
}

function AppContent({ onError }: { onError: (err: any) => void }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'dashboard' | 'builder'>('landing');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const workspaceMatch = location.pathname.match(/^\/workspace\/([^/]+)/);
    const projectMatch = location.pathname.match(/^\/project\/([^/]+)/);
    const workspaceRouteId = workspaceMatch?.[1];
    const projectRouteId = projectMatch?.[1];

    if (!user) {
      setView('landing');
      return;
    }

    if (location.pathname === '/') {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (location.pathname.startsWith('/builder')) {
      setView('builder');
      setSelectedProject(null);
    } else {
      setView('dashboard');
    }

    if (workspaceRouteId && workspaces.length > 0) {
      const matchingWorkspace = workspaces.find((ws) => String(ws.id) === workspaceRouteId);
      if (matchingWorkspace) {
        setActiveWorkspace(matchingWorkspace);
      }
    }

    if (projectRouteId && projects.length > 0) {
      const matchingProject = projects.find((project) => String(project.id) === projectRouteId);
      if (matchingProject) {
        setSelectedProject(matchingProject);
      } else {
        setSelectedProject(null);
      }
    } else if (!location.pathname.startsWith('/builder')) {
      setSelectedProject(null);
    }
  }, [location.pathname, navigate, user, workspaces, projects]);

  useEffect(() => {
    const workspaceMatch = location.pathname.match(/^\/workspace\/([^/]+)/);
    const workspaceRouteId = workspaceMatch?.[1];
    if (!workspaceRouteId || workspaces.length === 0) return;

    const matchingWorkspace = workspaces.find((ws) => String(ws.id) === workspaceRouteId);
    if (matchingWorkspace) {
      setActiveWorkspace(matchingWorkspace);
    }
  }, [location.pathname, workspaces]);

  useEffect(() => {
    // Handle Supabase OAuth redirect (access token in URL hash)
    async function handleOAuthRedirect() {
      try {
        const hash = window.location.hash || '';
        if (hash.includes('access_token') || hash.includes('provider_token') || hash.includes('refresh_token')) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error parsing OAuth redirect:', error);
            toast.error('Authentication failed during redirect');
          } else if (data?.session) {
            toast.success('Signed in successfully');
          }
          // Remove tokens from URL for cleanliness
          try {
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, cleanUrl);
          } catch (e) {
            // ignore
          }
        }
      } catch (err) {
        console.error('OAuth handling error', err);
      }
    }
    handleOAuthRedirect();
  }, []);
  
  // Schema Builder State
  const [rawInput, setRawInput] = useState('');
  const [newDashboardName, setNewDashboardName] = useState('');
  const [inputFormat, setInputFormat] = useState<'sql' | 'django' | 'json'>('sql');
  const [inputMode, setInputMode] = useState<'manual' | 'ai'>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedSchema, setGeneratedSchema] = useState('');
  const [generatedConfig, setGeneratedConfig] = useState<SchemaConfig | null>(null);
  const [generatedSchemaReason, setGeneratedSchemaReason] = useState('');
  const [generatedSchemaError, setGeneratedSchemaError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setView('dashboard');
        setProfileName(session.user.user_metadata?.full_name || '');
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      setUser(session?.user ?? null);
      if (session?.user) {
        setView('dashboard');
        setProfileName(session.user.user_metadata?.full_name || '');
      } else {
        setView('landing');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    console.log('Sign out initiated');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('Sign out successful');
      // Force view change and route reset
      setUser(null);
      setView('landing');
      navigate('/', { replace: true });
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(error.message || 'Failed to sign out');
    }
  };

  const fetchWorkspaces = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('workspaces')
      .select('*');
    
    if (error) {
      handleDatabaseError(error, OperationType.LIST, 'workspaces', user, onError);
    } else {
      setWorkspaces(data || []);
      if (data && data.length > 0 && !activeWorkspace) {
        setActiveWorkspace(data[0]);
      }
    }
  };

  
  const fetchProjects = async () => {
    if (!activeWorkspace) return;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', activeWorkspace.id);
    
    if (error) {
      handleDatabaseError(error, OperationType.LIST, 'projects', user, onError);
    } else {
      setProjects(data || []);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [activeWorkspace]);

  async function createWorkspace() {
    if (!user || !newWorkspaceName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: newWorkspaceName.trim(),
          slug: newWorkspaceName.trim().toLowerCase().replace(/\s+/g, '-'),
          owner_id: user.id,
          plan: 'free'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Workspace created');
      setNewWorkspaceName('');
      setIsCreatingWorkspace(false);
      if (data) {
        setActiveWorkspace(data);
        navigate(`/workspace/${data.id}`);
      }
      fetchWorkspaces();
    } catch (error) {
      handleDatabaseError(error, OperationType.CREATE, 'workspaces', user, onError);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-2 border-b border-zinc-800/50 md:border-b-0">
        <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
          <Database className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">AdminForge</span>
      </div>

      <div className="p-4 flex-1 overflow-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Workspaces</span>
            <Dialog open={isCreatingWorkspace} onOpenChange={setIsCreatingWorkspace}>
              <DialogTrigger render={<button className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer" />}>
                <Plus className="w-4 h-4" />
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
                <DialogHeader>
                  <DialogTitle>Create Workspace</DialogTitle>
                  <DialogDescription>Enter a name for your new workspace.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="ws-name" className="text-zinc-400">Workspace Name</Label>
                  <Input 
                    id="ws-name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g. Production, Staging"
                    className="bg-zinc-900 border-zinc-800 mt-2 text-white"
                    onKeyDown={(e) => e.key === 'Enter' && createWorkspace()}
                  />
                </div>
                <DialogFooter>
                  <Button onClick={createWorkspace} className="bg-orange-600 hover:bg-orange-700 w-full">
                    Create Workspace
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-1">
            {workspaces.map(ws => (
              <div key={ws.id} className="group relative">
                <button
                  onClick={() => {
                    navigate(`/workspace/${ws.id}`);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
                    activeWorkspace?.id === ws.id ? 'bg-orange-600/10 text-orange-500' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  {activeWorkspace?.id === ws.id && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />}
                  <span className="truncate pr-8">{ws.name}</span>
                </button>

                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-40 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" />}>
                      <MoreVertical className="w-3.5 h-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 text-white">
                      <DropdownMenuItem 
                        onClick={() => {
                          setEditingWorkspace(ws);
                          setEditWorkspaceName(ws.name);
                          setIsEditingWorkspace(true);
                        }}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setWorkspaceToDelete(ws)}
                        className="flex items-center gap-2 text-red-400 focus:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>

        <nav className="space-y-1">
          <div className="px-2 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Main</span>
          </div>
          <button 
            onClick={() => {
              navigate('/dashboard');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${view === 'dashboard' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboards
          </button>
          <button 
            onClick={() => {
              navigate('/builder');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${view === 'builder' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
          >
            <Plus className="w-4 h-4" />
            New Dashboard
          </button>
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-3 px-3 py-2 mb-2 group cursor-pointer hover:bg-zinc-800/50 rounded-md transition-colors" onClick={() => {
          setIsProfileModalOpen(true);
          setIsMobileSidebarOpen(false);
        }}>
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium group-hover:bg-zinc-700">
            {user?.email?.[0]?.toUpperCase() || ''}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-white">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email || ''}</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400" />
        </div>
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  const updateWorkspace = async () => {
    if (!editWorkspaceName.trim() || !editingWorkspace) return;
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: editWorkspaceName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingWorkspace.id);

      if (error) throw error;
      
      toast.success('Workspace updated');
      setIsEditingWorkspace(false);
      fetchWorkspaces();
    } catch (error) {
      handleDatabaseError(error, OperationType.UPDATE, 'workspaces', user, onError);
    }
  };

  const deleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceToDelete.id);

      if (error) throw error;
      
      toast.success('Workspace deleted');
      const nextWorkspace = workspaces.find((ws) => ws.id !== workspaceToDelete.id);
      if (activeWorkspace?.id === workspaceToDelete.id) {
        setActiveWorkspace(null);
        if (nextWorkspace) {
          setActiveWorkspace(nextWorkspace);
          navigate(`/workspace/${nextWorkspace.id}`);
        } else {
          navigate('/dashboard');
        }
      }
      setWorkspaceToDelete(null);
      fetchWorkspaces();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'workspaces', user, onError);
    }
  };

  const updateProfile = async () => {
    if (!user || !profileName.trim()) return;
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileName.trim() }
      });
      if (error) throw error;
      toast.success('Profile updated');
      setIsProfileModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const languageForFormat = (format: 'sql' | 'django' | 'json') => {
    return format === 'django' ? 'python' : format;
  };

  const highlightCode = (code: string, format: 'sql' | 'django' | 'json') => {
    const language = languageForFormat(format);
    const grammar = Prism.languages[language] || Prism.languages.sql;
    return Prism.highlight(code, grammar, language);
  };

  const handleGenerateAiSchema = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe the schema you want to generate');
      return;
    }

    setGeneratedSchemaError(null);
    setGeneratedConfig(null);
    setAiGenerating(true);

    try {
      const generatedSource = await generateSchemaFromDescription(aiPrompt.trim(), inputFormat);
      const config = await parseSchema(generatedSource, inputFormat);
      if (!validateSchemaConfig(config)) {
        throw new Error('AI returned an invalid schema structure.');
      }

      setGeneratedSchema(generatedSource);
      setGeneratedConfig(config);
      toast.success('AI generated a schema. Review it below and then create the dashboard.');
    } catch (error: any) {
      const message = error?.message || 'Failed to generate schema using AI.';
      console.error('AI Schema Generation Error:', error);
      setGeneratedSchemaError(message);
      toast.error(message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleReviewSchemaWithAi = async () => {
    if (!rawInput.trim()) {
      toast.error('Please paste your schema first before asking for AI suggestions.');
      return;
    }

    setGeneratedSchemaError(null);
    setGeneratedConfig(null);
    setGeneratedSchemaReason('');
    setIsReviewing(true);

    try {
      const review = await reviewSchemaWithAi(rawInput, inputFormat);
      setGeneratedSchema(review.review);
      setGeneratedSchemaReason(review.reason);
      toast.success('AI suggestions are ready. Review them on the right and apply if desired.');
    } catch (error: any) {
      const message = error?.message || 'Failed to review schema using AI.';
      console.error('AI Review Error:', error);
      setGeneratedSchemaError(message);
      toast.error(message);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleGenerate = async () => {
    if (!activeWorkspace || !user) {
      toast.error('Please select or create a workspace first');
      return;
    }

    setParsing(true);
    try {
      let config: SchemaConfig;
      let sourceDescription = '';

      if (inputMode === 'ai') {
        if (!generatedSchema) {
          toast.error('Please generate a schema first using AI Assist');
          return;
        }

        if (generatedConfig) {
          config = generatedConfig;
        } else {
          config = await parseSchema(generatedSchema, inputFormat);
          if (!validateSchemaConfig(config)) {
            toast.error('Generated schema is not valid. Please review the output.');
            return;
          }
        }

        sourceDescription = `Generated from AI Assist (${inputFormat.toUpperCase()})`;
      } else {
        if (!rawInput) {
          toast.error('Please enter a schema');
          return;
        }

        config = await parseSchema(rawInput, inputFormat);
        sourceDescription = `Generated from ${inputFormat.toUpperCase()} schema`;
      }

      const dashboardConfig = generateDashboardConfig(config);

      const insertObj: any = {
        workspace_id: activeWorkspace.id,
        name: newDashboardName.trim() || `Project ${projects.length + 1}`,
        description: sourceDescription,
        inputType: inputMode === 'ai' ? `ai-${inputFormat}` : inputFormat,
        created_by: user.id,
        config: { ...config, dashboardConfig }
      };

      const insertProject = async (payload: any) => supabase.from('projects').insert(payload).select().single();
      let insertResult: any = await insertProject(insertObj);
      if (insertResult.error) {
        const msg = insertResult.error.message || String(insertResult.error);
        if (msg.includes("'inputType'") || msg.includes('inputType')) {
          const fallback = { ...insertObj };
          delete fallback.inputType;
          insertResult = await insertProject(fallback);
          if (insertResult.error) throw insertResult.error;
          toast.warning('Dashboard generated; `inputType` was not saved because your database schema is missing that column. Consider adding an `inputType` column to `projects`.');
        } else {
          throw insertResult.error;
        }
      }

      const insertedProject = insertResult.data;
      const generatedProjectId = insertedProject?.id;
      toast.success('Dashboard generated!');
      setRawInput('');
      setAiPrompt('');
      setGeneratedSchema('');
      setNewDashboardName('');
      if (insertedProject) {
        setProjects((prev) => [insertedProject, ...prev.filter((p: any) => p.id !== insertedProject.id)]);
        setSelectedProject(insertedProject);
      }
      setView('dashboard');
      fetchProjects();
      if (generatedProjectId) {
        navigate(`/project/${generatedProjectId}`);
      }
    } catch (error: any) {
      handleDatabaseError(error, OperationType.CREATE, 'projects', user, onError);
    } finally {
      setParsing(false);
    }
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-orange-500/30">
        <nav className="border-b border-zinc-800/50 px-6 py-4 flex justify-between items-center backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">AdminForge</span>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setIsAuthModalOpen(true)} className="bg-orange-600 hover:bg-orange-700">
              Get Started
            </Button>
          </div>
        </nav>

        <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
          <DialogContent className="bg-transparent border-none p-0 max-w-md shadow-none">
            <AuthForm />
          </DialogContent>
        </Dialog>

        <main className="max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-4 border-orange-500/20 text-orange-500 bg-orange-500/5 px-3 py-1 uppercase tracking-wider text-sm">
              v1.0 is now live
            </Badge>
            <h1 className="text-3xl md:text-7xl font-bold tracking-tighter mb-6 text-white md:bg-gradient-to-b md:from-white md:to-zinc-500 md:bg-clip-text md:text-transparent">
              Turn your schema into a <br /> powerful admin dashboard.
            </h1>
            <p className="text-zinc-200 text-base md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              AdminForge auto-generates CRUD pages, analytics, and RBAC from your database schema or Django models in seconds.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={() => setIsAuthModalOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-md shadow-lg hover:shadow-xl transition-transform transform-gpu hover:-translate-y-0.5">
                Get Started Free
              </Button>
            </div>
          </motion.div>

          <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {[
              { icon: Database, title: "Schema Engine", desc: "Supports SQL, Django models, and JSON. Auto-detects relationships and field types." },
              { icon: BarChart3, title: "Auto Analytics", desc: "Instant charts and stats for every model. Track trends and aggregates automatically." },
              { icon: ShieldCheck, title: "Built-in RBAC", desc: "Role-based access control out of the box. Assign permissions per model and role." }
            ].map((feature, i) => (
              <Card key={i} className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center mb-2">
                    <feature.icon className="w-6 h-6 text-orange-500" />
                  </div>
                  <CardTitle className="text-white">{feature.title}</CardTitle>
                  <CardDescription className="text-zinc-400">{feature.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row dark">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-800/50 flex flex-col bg-zinc-900/20">
        <div className="p-4 md:p-6 flex items-center gap-2 border-b border-zinc-800/50 md:border-b-0">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">AdminForge</span>
        </div>

        <div className="p-4 md:p-4 flex-1 overflow-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Workspaces</span>
              <Dialog open={isCreatingWorkspace} onOpenChange={setIsCreatingWorkspace}>
                <DialogTrigger render={<button className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer" />}>
                  <Plus className="w-4 h-4" />
                </DialogTrigger>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                    <DialogDescription>Enter a name for your new workspace.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="ws-name" className="text-zinc-400">Workspace Name</Label>
                    <Input 
                      id="ws-name"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="e.g. Production, Staging"
                      className="bg-zinc-900 border-zinc-800 mt-2 text-white"
                      onKeyDown={(e) => e.key === 'Enter' && createWorkspace()}
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={createWorkspace} className="bg-orange-600 hover:bg-orange-700 w-full">
                      Create Workspace
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-1">
              {workspaces.map(ws => (
                <div key={ws.id} className="group relative">
                  <button
                    onClick={() => {
                      navigate(`/workspace/${ws.id}`);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
                      activeWorkspace?.id === ws.id ? 'bg-orange-600/10 text-orange-500' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }`}
                  >
                    {activeWorkspace?.id === ws.id && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />}
                    <span className="truncate pr-8">{ws.name}</span>
                  </button>
                  
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-40 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" />}>
                        <MoreVertical className="w-3.5 h-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 text-white">
                        <DropdownMenuItem 
                          onClick={() => {
                            setEditingWorkspace(ws);
                            setEditWorkspaceName(ws.name);
                            setIsEditingWorkspace(true);
                          }}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setWorkspaceToDelete(ws)}
                          className="flex items-center gap-2 text-red-400 focus:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <nav className="space-y-1">
            <div className="px-2 mb-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Main</span>
            </div>
            <button 
              onClick={() => {
                navigate('/dashboard');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${view === 'dashboard' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboards
            </button>
            <button 
              onClick={() => {
                navigate('/builder');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${view === 'builder' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
            >
              <Plus className="w-4 h-4" />
              New Dashboard
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-zinc-800/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-2 group cursor-pointer hover:bg-zinc-800/50 rounded-md transition-colors" onClick={() => setIsProfileModalOpen(true)}>
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium group-hover:bg-zinc-700">
                {user?.email?.[0]?.toUpperCase() || ''}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-white">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email || ''}</p>
              </div>
            <Settings className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400" />
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-4 md:px-8 bg-zinc-950/50 backdrop-blur-sm">
          <h2 className="font-semibold text-lg truncate text-center md:text-left">
            {view === 'dashboard' ? 'My Dashboards' : 'Generate New Dashboard'}
          </h2>
          <div className="flex items-center gap-3">
            <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden text-zinc-400"><Menu className="w-5 h-5" /></Button>} />
              <SheetContent side="left" className="bg-zinc-950 border-r border-zinc-800 text-white p-0">
                {sidebarContent}
              </SheetContent>
            </Sheet>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400"
              onClick={() => setIsProfileModalOpen(true)}
              aria-label="Open profile settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              {selectedProject ? (
                <motion.div
                  key="renderer"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <DashboardRenderer 
                    workspaceId={activeWorkspace.id} 
                    schema={projects.find(s => s.id === selectedProject.id) || selectedProject} 
                    onBack={() => {
                      setSelectedProject(null);
                      fetchProjects();
                      navigate('/dashboard');
                    }} 
                  />
                </motion.div>
              ) : view === 'dashboard' ? (
                <motion.div
                  key="dash"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {projects.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-xl">
                      <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileCode className="w-8 h-8 text-zinc-700" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">No dashboards yet</h3>
                      <p className="text-zinc-500 mb-6">Start by generating a dashboard from your schema.</p>
                      <Button onClick={() => navigate('/builder')} className="bg-orange-600 hover:bg-orange-700">
                        Create Your First Dashboard
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {projects.map(s => (
                        <Card 
                          key={s.id} 
                          onClick={() => {
                            setSelectedProject(s);
                            navigate(`/project/${s.id}`);
                          }}
                          className="bg-zinc-900/50 border-zinc-800/50 hover:border-orange-500/50 transition-all group cursor-pointer"
                        >
                          <CardHeader>
                            <div className="flex justify-between items-start mb-2">
                              <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 group-hover:bg-orange-500/10 group-hover:text-orange-500">
                                {((s.inputType || s.config?.inputType || 'unknown') as string).toUpperCase()}
                              </Badge>
                              <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                                {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Recent'}
                              </span>
                            </div>
                            <CardTitle className="text-white group-hover:text-orange-500 transition-colors">{s.name}</CardTitle>
                            <CardDescription className="text-zinc-500 line-clamp-2">
                              {(s.config?.models?.length ?? 0)} Models detected: {(Array.isArray(s.config?.models) ? s.config.models.map((m: any) => m.name).join(', ') : 'N/A')}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Button variant="ghost" className="w-full justify-between text-zinc-400 group-hover:text-white">
                              Open Dashboard
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="builder"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-5xl mx-auto"
                >
                  <Card className="bg-zinc-900/80 border border-zinc-800">
                    <CardHeader>
                      <CardTitle>Schema Importer</CardTitle>
                      <CardDescription>Paste your database schema or Django models to generate a dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label>Dashboard Name</Label>
                        <Input 
                          value={newDashboardName}
                          onChange={(e) => setNewDashboardName(e.target.value)}
                          placeholder="e.g. E-commerce Admin, Inventory System"
                          className="bg-zinc-950 border-zinc-800 text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Input Mode</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
                          <button
                            type="button"
                            onClick={() => setInputMode('manual')}
                            className={`flex w-full items-start gap-3 rounded-xl px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${inputMode === 'manual' ? 'bg-zinc-800 text-white shadow-sm shadow-zinc-950/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}
                          >
                            <ClipboardList className="w-5 h-5" />
                            <div>
                              <p className="font-medium">Manual Paste</p>
                              <p className="text-xs text-zinc-500">Edit schema directly</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputMode('ai')}
                            className={`flex w-full items-start gap-3 rounded-xl px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${inputMode === 'ai' ? 'bg-zinc-800 text-white shadow-sm shadow-zinc-950/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}
                          >
                            <Sparkles className="w-5 h-5" />
                            <div>
                              <p className="font-medium">AI Assist</p>
                              <p className="text-xs text-zinc-500">Describe your schema and get suggestions</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Input Format</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => setInputFormat('sql')}
                            className={`w-full rounded-2xl border px-3 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${inputFormat === 'sql' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'}`}
                          >
                            SQL CREATE
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputFormat('django')}
                            className={`w-full rounded-2xl border px-3 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${inputFormat === 'django' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'}`}
                          >
                            Django Models
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputFormat('json')}
                            className={`w-full rounded-2xl border px-3 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${inputFormat === 'json' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'}`}
                          >
                            JSON Schema
                          </button>
                        </div>
                      </div>

                      {inputMode === 'ai' ? (
                        <>
                          <div className="space-y-2">
                            <Label>Describe your schema</Label>
                            <div className="relative">
                              <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="e.g. I want a product system with name, price, and category"
                                className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-md p-4 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button onClick={handleGenerateAiSchema} disabled={!aiPrompt.trim() || aiGenerating} className="w-full sm:w-auto bg-orange-600 text-black hover:bg-orange-700">
                              {aiGenerating ? 'Generating schema...' : 'Generate Candidate Schema'}
                            </Button>
                            {generatedSchema && (
                              <span className="text-zinc-400 text-sm self-center">
                                Review the generated schema below before creating the dashboard.
                              </span>
                            )}
                          </div>

                          {generatedSchemaError && (
                            <p className="text-sm text-red-400">{generatedSchemaError}</p>
                          )}

                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Raw Schema Content</Label>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 max-h-[32rem] overflow-auto">
                              <Editor
                                value={rawInput}
                                onValueChange={(value) => setRawInput(value)}
                                highlight={(code) => highlightCode(code, inputFormat)}
                                padding={16}
                                textareaId="raw-schema-editor"
placeholder={
  inputFormat === 'sql'
    ? `CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL
);`
    : inputFormat === 'django'
    ? `class Product(models.Model):
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=12, decimal_places=2)`
    : `{
  "models": [
    {
      "name": "Product",
      "fields": [ { "name": "price", "type": "decimal" } ]
    }
  ]
}`
}
                                className="min-h-[24rem] w-full rounded-2xl bg-transparent font-mono text-sm text-zinc-100 focus:outline-none overflow-auto"
                                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <Button
                              onClick={handleReviewSchemaWithAi}
                              disabled={!rawInput.trim() || isReviewing}
                              className="w-full sm:w-auto bg-orange-600 text-black hover:bg-orange-700"
                            >
                              {isReviewing ? 'Reviewing with AI...' : 'Review with AI'}
                            </Button>
                            <span className="text-zinc-400 text-sm sm:max-w-xl">
                              Generate AI suggestions for your current manual schema. Apply the suggestion if you want improved syntax, or continue with the original schema as-is.
                            </span>
                          </div>

                          {generatedSchemaError && (
                            <p className="text-sm text-red-400">{generatedSchemaError}</p>
                          )}
                        </div>
                      )}
                        </div>
                        <div className="space-y-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                              <Label className="mb-1">{inputMode === 'manual' ? 'AI Suggestions' : 'Generated Schema'}</Label>
                              <p className="text-sm text-zinc-500">
                                {inputMode === 'manual'
                                  ? 'Review AI suggestions for your current schema here. Apply them if you want improved syntax, or continue with your original input.'
                                  : 'Review and edit the generated schema output.'}
                              </p>
                            </div>
                            {inputMode === 'ai' && generatedSchema && (
                              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">AI Assist Preview</span>
                            )}
                          </div>

                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 max-h-[24rem] overflow-auto">
                            <Editor
                              value={generatedSchema}
                              onValueChange={(value) => {
                                setGeneratedSchema(value);
                                setGeneratedConfig(null);
                              }}
                              highlight={(code) => highlightCode(code, inputFormat)}
                              padding={16}
                              textareaId="generated-schema-editor"
                              placeholder={inputMode === 'manual'
                                ? 'AI suggestions will appear here after review. You can edit them or apply the suggestion back to your raw schema.'
                                : 'Generated schema will appear here... (You can edit it once generated)'
                              }
                              className="min-h-[24rem] w-full rounded-2xl bg-transparent font-mono text-sm text-zinc-100 focus:outline-none overflow-auto"
                              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                            />
                          </div>

                          {inputMode === 'manual' && generatedSchema && generatedSchema.trim() !== rawInput.trim() && (
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  setRawInput(generatedSchema);
                                  toast.success('AI suggestion applied to the raw schema editor.');
                                }}
                                className="bg-orange-600 text-black hover:bg-orange-700 text-sm rounded-full px-4 py-2"
                              >
                                Use AI suggestion
                              </Button>
                            </div>
                          )}

                          {inputMode === 'manual' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="mb-1">Reason for the suggestion</Label>
                              </div>
                              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 max-h-[18rem] overflow-auto p-4 text-sm text-zinc-200 whitespace-pre-wrap">
                                {generatedSchemaReason
                                  ? generatedSchemaReason
                                  : 'AI will explain why the suggestion was made, what to improve, and features to consider for the future.'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button 
                        onClick={handleGenerate} 
                        disabled={(inputMode === 'ai' ? !generatedSchema : !rawInput) || parsing}
                        className="w-full bg-[#9a3412] hover:bg-[#7c2d12] h-14 text-lg font-semibold"
                      >
                        {parsing ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Analyzing Schema...
                          </span>
                        ) : 'Generate Dashboard'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </main>
      <Toaster position="bottom-right" theme="dark" />

      {/* Workspace Edit Dialog */}
      <Dialog open={isEditingWorkspace} onOpenChange={setIsEditingWorkspace}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>Enter a new name for your workspace.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-ws-name" className="text-zinc-400">Workspace Name</Label>
            <Input 
              id="edit-ws-name"
              value={editWorkspaceName}
              onChange={(e) => setEditWorkspaceName(e.target.value)}
              className="bg-zinc-900 border-zinc-800 mt-2 text-white"
              onKeyDown={(e) => e.key === 'Enter' && updateWorkspace()}
            />
          </div>
          <DialogFooter>
            <Button onClick={updateWorkspace} className="bg-orange-600 hover:bg-orange-700 w-full">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workspace Delete Alert */}
      <AlertDialog open={!!workspaceToDelete} onOpenChange={(open) => !open && setWorkspaceToDelete(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete the workspace "{workspaceToDelete?.name}" and all associated dashboards. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="default" size="default" onClick={deleteWorkspace} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Settings Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>Update your personal information.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name" className="text-zinc-400">Full Name</Label>
              <Input 
                id="profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your Name"
                className="bg-zinc-900 border-zinc-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Email Address</Label>
              <Input 
                value={user.email}
                disabled
                className="bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-zinc-600 italic">Email cannot be changed in this demo.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={updateProfile} className="bg-orange-600 hover:bg-orange-700 w-full">
              Update Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function App() {
  const [error, setError] = useState<any>(null);

  if (!hasSupabaseCredentials) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-red-500">Supabase Configuration Required</CardTitle>
            <CardDescription className="text-zinc-400">
              Missing environment variables: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
              Create a <code>.env.local</code> file or copy <code>.env.example</code> and restart the dev server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full bg-zinc-800 hover:bg-zinc-700">
              Reload Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    let errorMessage = "Something went wrong.";
    if (error.error) errorMessage = error.error;
    
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-red-500">Connection Error</CardTitle>
            <CardDescription className="text-zinc-400">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full bg-zinc-800 hover:bg-zinc-700">
              Reload Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <AppContent onError={setError} />
      <Toaster position="bottom-right" theme="dark" />
    </>
  );
}

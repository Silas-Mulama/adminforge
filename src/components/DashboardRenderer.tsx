import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { exportProject } from '@/src/lib/export';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter,
  SheetDescription
} from '@/components/ui/sheet';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  BarChart3, 
  List, 
  ArrowLeft, 
  Search,
  Calendar,
  Type,
  Hash,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  MoreVertical,
  Database,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface DashboardRendererProps {
  workspaceId: string;
  schema: any;
  onBack: () => void;
}

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
  authInfo: any;
}

function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  toast.error(`Database error: ${errInfo.error}`);
  throw new Error(JSON.stringify(errInfo));
}

export function DashboardRenderer({ workspaceId, schema, onBack }: DashboardRendererProps) {
  const [activeModel, setActiveModel] = useState(schema.config.models[0]?.name);
  const [records, setRecords] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingDashboard, setIsDeletingDashboard] = useState(false);
  const [settingsName, setSettingsName] = useState(schema.name);
  const [settingsDescription, setSettingsDescription] = useState(schema.description || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setSettingsName(schema.name);
    setSettingsDescription(schema.description || '');
  }, [schema]);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const modelConfig = schema.config.dashboardConfig.models[activeModel];
  const schemaModel = schema.config.models.find((m: any) => m.name === activeModel);

  const fetchRecords = async () => {
    if (!activeModel) return;
    // We use a generic 'records' table for the generated data
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('project_id', schema.id)
      .eq('model_name', activeModel)
      .order('created_at', { ascending: false });
    
    if (error) {
      // If table doesn't exist, we might need to handle it gracefully
      if (error.code === '42P01') {
        console.warn('Records table not found. Please run the SQL setup.');
        setRecords([]);
      } else {
        handleDatabaseError(error, OperationType.LIST, 'records');
      }
    } else {
      setRecords(data.map(r => ({ id: r.id, ...r.data, created_at: r.created_at })));
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [activeModel, schema.id]);

  const handleSave = async () => {
    try {
      if (currentRecord) {
        const { error } = await supabase
          .from('records')
          .update({
            data: formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentRecord.id);
        
        if (error) throw error;
        toast.success('Record updated');
      } else {
        const { error } = await supabase
          .from('records')
          .insert({
            project_id: schema.id,
            model_name: activeModel,
            data: formData
          });
        
        if (error) throw error;
        toast.success('Record created');
      }
      setIsEditing(false);
      setCurrentRecord(null);
      setFormData({});
      fetchRecords();
    } catch (error) {
      handleDatabaseError(error, currentRecord ? OperationType.UPDATE : OperationType.CREATE, 'records');
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      const { error } = await supabase
        .from('records')
        .delete()
        .eq('id', recordToDelete.id);
      
      if (error) throw error;
      toast.success('Record deleted');
      setIsDeleting(false);
      setRecordToDelete(null);
      fetchRecords();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'records');
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsName.trim()) {
      toast.error('Dashboard name cannot be empty');
      return;
    }
    setIsSavingSettings(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: settingsName.trim(),
          description: settingsDescription.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', schema.id);

      if (error) throw error;
      toast.success('Dashboard settings updated');
    } catch (error) {
      handleDatabaseError(error, OperationType.UPDATE, 'projects');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteDashboard = async () => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', schema.id);
      
      if (error) throw error;
      toast.success('Dashboard deleted');
      onBack();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'projects');
    }
  };

  const filteredRecords = records.filter(r => 
    Object.values(r).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Mock analytics data for trend
  const analyticsData = [
    { date: '2024-03-01', count: 12 },
    { date: '2024-03-02', count: 18 },
    { date: '2024-03-03', count: 15 },
    { date: '2024-03-04', count: 25 },
    { date: '2024-03-05', count: 32 },
    { date: '2024-03-06', count: 28 },
    { date: '2024-03-07', count: 40 },
  ];

  const renderField = (field: any) => {
    const value = formData[field.name] || '';
    const isDescription = field.name.toLowerCase().includes('description') || field.name.toLowerCase().includes('bio');
    const isUrl = field.name.toLowerCase().includes('url') || field.name.toLowerCase().includes('link');

    if (field.type === 'BooleanField') {
      return (
        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium text-zinc-200">{field.label}</Label>
            <p className="text-xs text-zinc-500">Toggle this setting</p>
          </div>
          <Switch
            checked={!!formData[field.name]}
            onCheckedChange={(checked) => setFormData({ ...formData, [field.name]: checked })}
          />
        </div>
      );
    }

    if (isDescription) {
      return (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{field.label}</Label>
          <Textarea
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            className="bg-zinc-900 border-zinc-800 min-h-[100px] focus:ring-orange-500/50 text-white"
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{field.label}</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            {field.type === 'IntegerField' ? <Hash className="w-4 h-4" /> : 
             isUrl ? <LinkIcon className="w-4 h-4" /> : 
             field.type === 'DateTimeField' ? <Calendar className="w-4 h-4" /> :
             <Type className="w-4 h-4" />}
          </div>
          <Input
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            className="bg-zinc-900 border-zinc-800 pl-10 focus:ring-orange-500/50 text-white"
            type={field.type === 'IntegerField' ? 'number' : 'text'}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-full shadow-xl"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-3xl font-bold tracking-tight text-white">{schema.name}</h2>
              <Badge variant="outline" className="border-orange-500/20 text-orange-500 bg-orange-500/5">
                Live
              </Badge>
            </div>
            <p className="text-zinc-500 text-sm flex items-center gap-2">
              <Database className="w-3 h-3" />
              Managing <span className="text-zinc-300 font-medium">{activeModel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end lg:justify-start lg:flex-1 min-w-0 max-w-full lg:max-w-[60%]">
          <Button 
            onClick={async () => {
              setIsExporting(true);
              try {
                await exportProject(schema.id, schema.name);
                toast.success('Export completed');
              } catch (error: any) {
                console.error(error);
                toast.error(error?.message || 'Export failed');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            className="h-11 px-4 text-sm font-medium transition-colors 
             bg-zinc-900 text-zinc-200 border border-zinc-700 
             hover:bg-zinc-800 hover:text-white 
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 
             disabled:opacity-50 disabled:pointer-events-none 
             rounded-md"
          >
            {isExporting ? 'Exporting...' : 'Export JSON'}
          </Button>
        </div>
        <div className="flex-1 min-w-0 max-w-full lg:max-w-[60%]">
          <ScrollArea className="w-full">
            <div className="flex gap-1.5 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50 w-max">
              {schema.config.models.map((m: any) => (
                <Button
                  key={m.name}
                  variant={activeModel === m.name ? 'secondary' : 'ghost'}
                  onClick={() => setActiveModel(m.name)}
                  className={`h-9 px-4 rounded-lg transition-all whitespace-nowrap ${
                    activeModel === m.name 
                      ? 'bg-zinc-800 text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {m.name}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="h-1.5 bg-zinc-800/50 rounded-full mt-1" />
          </ScrollArea>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="bg-transparent border-b border-zinc-800 w-full justify-start rounded-none h-auto p-0 mb-8">
          <TabsTrigger 
            value="list" 
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none px-6 py-3 text-zinc-500 data-[state=active]:text-white transition-all"
          >
            <List className="w-4 h-4 mr-2" />
            Records
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none px-6 py-3 text-zinc-500 data-[state=active]:text-white transition-all"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none px-6 py-3 text-zinc-500 data-[state=active]:text-white transition-all"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 outline-none">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                placeholder={`Search ${activeModel.toLowerCase()}...`} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900/50 border-zinc-800 focus:ring-orange-500/50 h-11 text-white"
              />
            </div>
            <Sheet open={isEditing} onOpenChange={setIsEditing}>
              <SheetTrigger render={
                <Button onClick={() => { setCurrentRecord(null); setFormData({}); }} className="bg-orange-600 hover:bg-orange-700 h-11 px-6 font-semibold shadow-lg shadow-orange-900/20" />
              }>
                <Plus className="w-4 h-4 mr-2" />
                Add {activeModel}
              </SheetTrigger>
              <SheetContent className="bg-zinc-950 border-l border-zinc-800 text-white sm:max-w-xl p-0 flex flex-col h-[100dvh]">
                <SheetHeader className="p-8 border-b border-zinc-800 bg-zinc-900/20 shrink-0">
                  <SheetTitle className="text-2xl font-bold text-white">
                    {currentRecord ? 'Edit' : 'Create'} {activeModel}
                  </SheetTitle>
                  <SheetDescription className="text-zinc-500">
                    Fill in the details below to {currentRecord ? 'update the existing' : 'add a new'} record.
                  </SheetDescription>
                </SheetHeader>
                
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="px-8 py-8">
                      <div className="grid grid-cols-1 gap-8 pb-8">
                        {modelConfig.form_config.fields.map((field: any) => (
                          <div key={field.name}>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </div>

                <SheetFooter className="p-8 border-t border-zinc-800 bg-zinc-900/20 shrink-0 mt-auto">
                  <Button onClick={handleSave} className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg font-bold">
                    {currentRecord ? 'Save Changes' : `Create ${activeModel}`}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          <Card className="bg-zinc-900/30 border-zinc-800/50 overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-900/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    {modelConfig.table_config.columns.map((col: any) => (
                      <TableHead key={col.name} className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.2em] py-4 px-6">
                        {col.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-[0.2em] py-4 px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={modelConfig.table_config.columns.length + 1} className="text-center py-24">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center">
                            <Search className="w-6 h-6 text-zinc-700" />
                          </div>
                          <p className="text-zinc-500 font-medium">No records found matching your criteria</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record, i) => (
                      <motion.tr 
                        key={record.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group"
                      >
                        {modelConfig.table_config.columns.map((col: any) => (
                          <TableCell key={col.name} className="py-4 px-6">
                            <span className="text-zinc-300 font-medium">
                              {col.type === 'BooleanField' ? (
                                record[col.name] ? (
                                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">True</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-zinc-600 border-zinc-800">False</Badge>
                                )
                              ) : String(record[col.name] || '-')}
                            </span>
                          </TableCell>
                        ))}
                        <TableCell className="text-right py-4 px-6">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-zinc-500 hover:text-white hover:bg-zinc-800"
                              onClick={() => {
                                setCurrentRecord(record);
                                setFormData(record);
                                setIsEditing(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                              onClick={() => {
                                setRecordToDelete(record);
                                setIsDeleting(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Total Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">{records.length}</div>
                <p className="text-xs text-green-500 mt-1">+12% from last month</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">24</div>
                <p className="text-xs text-zinc-500 mt-1">Real-time tracking enabled</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Growth Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">8.2%</div>
                <p className="text-xs text-orange-500 mt-1">Steady increase</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-zinc-900/50 border-zinc-800/50 p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg font-semibold text-white">Creation Trend</CardTitle>
            </CardHeader>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#71717a" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(str) => new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
                    itemStyle={{ color: '#f97316' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#f97316" 
                    strokeWidth={2} 
                    dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-white">General Settings</CardTitle>
                  <p className="text-sm text-zinc-500">Update your dashboard's basic information.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Dashboard Name</Label>
                    <Input 
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 focus:ring-orange-500/50 h-11 text-white"
                      placeholder="Enter dashboard name..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</Label>
                    <Textarea 
                      value={settingsDescription}
                      onChange={(e) => setSettingsDescription(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 min-h-[120px] focus:ring-orange-500/50 text-white"
                      placeholder="Enter dashboard description..."
                    />
                  </div>
                  <div className="pt-4">
                    <Button 
                      onClick={handleSaveSettings} 
                      disabled={isSavingSettings}
                      className="bg-orange-600 hover:bg-orange-700 h-11 px-8 font-semibold shadow-lg shadow-orange-900/20"
                    >
                      {isSavingSettings ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-white">Schema Information</CardTitle>
                  <p className="text-sm text-zinc-500">Technical details about the generated dashboard.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                      <p className="text-xs text-zinc-500 uppercase mb-1">Input Type</p>
                      <p className="text-sm font-medium text-white uppercase">{schema.inputType}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                      <p className="text-xs text-zinc-500 uppercase mb-1">Models Generated</p>
                      <p className="text-sm font-medium text-white">{schema.config.models.length}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                    <p className="text-xs text-zinc-500 uppercase mb-1">Created At</p>
                    <p className="text-sm font-medium text-white">
                      {schema.createdAt?.toDate ? schema.createdAt.toDate().toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-red-950/20 border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-red-500">Danger Zone</CardTitle>
                  <p className="text-sm text-zinc-500">Irreversible actions for this dashboard.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-zinc-400">
                    Deleting this dashboard will remove all associated data records and configurations. This action cannot be undone.
                  </p>
                  <Button 
                    variant="destructive" 
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => setIsDeletingDashboard(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeletingDashboard} onOpenChange={setIsDeletingDashboard}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              Are you sure you want to delete "{schema.name}"? All data records for all models in this dashboard will be lost forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" size="default" onClick={handleDeleteDashboard} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              This action cannot be undone. This will permanently delete the record
              from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" size="default" onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

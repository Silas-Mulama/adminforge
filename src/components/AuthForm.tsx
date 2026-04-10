import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Lock, Chrome, Loader2, User, ArrowRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [activeTab, setActiveTab] = useState('login');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success('Logged in successfully');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      toast.success('Check your email for the confirmation link!');
    } catch (error: any) {
      toast.error(error.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Google login failed');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.4,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <Card className="w-full max-w-md bg-zinc-950/80 border-zinc-800/50 text-white shadow-2xl backdrop-blur-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent pointer-events-none" />
      
      <CardHeader className="space-y-2 text-center pb-8 pt-10 relative">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-orange-600/20"
        >
          <Lock className="w-6 h-6 text-white" />
        </motion.div>
        <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          AdminForge
        </CardTitle>
        <CardDescription className="text-zinc-500 text-sm font-medium">
          {activeTab === 'login' ? 'Welcome back! Please enter your details.' : 'Start building your admin dashboards today.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 relative">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-900/50 p-1 border border-zinc-800/50 rounded-xl h-12">
            <TabsTrigger 
              value="login" 
              className="rounded-lg text-zinc-300 data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              Login
            </TabsTrigger>
            <TabsTrigger 
              value="register" 
              className="rounded-lg text-zinc-300 data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              Register
            </TabsTrigger>
          </TabsList>
          
          <AnimatePresence mode="wait">
            <TabsContent value="login" key="login" className="mt-6 focus-visible:outline-none">
              <motion.form 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                onSubmit={handleEmailLogin} 
                className="space-y-5"
              >
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Email Address</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 pl-10 h-11 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                      required
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" text-xs font-semibold text-zinc-500 uppercase tracking-wider>Password</Label>
                    <button type="button" className="text-[10px] font-bold text-orange-500 hover:text-orange-400 uppercase tracking-widest transition-colors">
                      Forgot?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 pl-10 h-11 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                      required
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-2">
                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-base font-bold shadow-lg shadow-orange-600/20 group" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />}
                    Sign In
                  </Button>
                </motion.div>
              </motion.form>
            </TabsContent>

            <TabsContent value="register" key="register" className="mt-6 focus-visible:outline-none">
              <motion.form 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                onSubmit={handleEmailSignUp} 
                className="space-y-5"
              >
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="reg-name" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Full Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 pl-10 h-11 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                      required
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="reg-email" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Email Address</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 pl-10 h-11 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                      required
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="reg-password" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 pl-10 h-11 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                      required
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-2">
                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-base font-bold shadow-lg shadow-orange-600/20 group" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />}
                    Create Account
                  </Button>
                </motion.div>
              </motion.form>
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative py-4"
        >
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-800/50" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
            <span className="bg-zinc-950 px-4 text-zinc-500">Or continue with</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            variant="outline"
            type="button"
            className="w-full border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800 text-white h-11 rounded-xl transition-all"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <Chrome className="w-4 h-4 mr-2 text-orange-500" />
            Google
          </Button>
        </motion.div>
      </CardContent>
      
      <CardFooter className="bg-zinc-900/20 border-t border-zinc-800/50 py-6">
        <p className="text-center text-[10px] text-zinc-500 w-full leading-relaxed uppercase tracking-wider">
          By clicking continue, you agree to our <br />
          <span className="text-zinc-400 hover:text-white cursor-pointer transition-colors">Terms of Service</span> and <span className="text-zinc-400 hover:text-white cursor-pointer transition-colors">Privacy Policy</span>.
        </p>
      </CardFooter>
    </Card>
  );
}

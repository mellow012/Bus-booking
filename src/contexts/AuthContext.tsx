'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile: { firstName: string; lastName: string; phone: string; role: 'customer' | 'company_admin' }
  ) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  // Utility function to determine redirect path based on user role and profile
  const getRedirectPath = useCallback((profile: UserProfile): string => {
    if (profile.role === 'customer') {
      return '/'; // Home page for customers
    } else if (profile.role === 'company_admin') {
      if (profile.companyId) {
        return '/admin'; // Company dashboard if company exists
      } else {
        return '/create-company'; // Company creation if no company
      }
    }
    return '/'; // Fallback
  }, []);

  // Refresh user profile from Firestore
  const refreshUserProfile = useCallback(async () => {
    if (!user?.uid) {
      console.warn('Cannot refresh profile - no user UID available');
      return;
    }

    try {
      console.log('Refreshing user profile for UID:', user.uid);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const profile = { id: user.uid, ...userDoc.data() } as UserProfile;
        console.log('Profile refreshed successfully:', profile);
        setUserProfile(profile);
      } else {
        console.warn('User document does not exist for UID:', user.uid);
        setUserProfile(null);
      }
    } catch (error: any) {
      console.error('Error refreshing user profile:', error);
    }
  }, [user?.uid]);

  // Handle auth state changes
  useEffect(() => {
    console.log('Setting up auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed - User:', currentUser?.uid || 'none');
      
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        try {
          // Fetch user profile
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const profile = { id: currentUser.uid, ...userDoc.data() } as UserProfile;
            console.log('User profile loaded:', profile);
            setUserProfile(profile);
          } else {
            console.warn('No user document found for UID:', currentUser.uid);
            setUserProfile(null);
          }
        } catch (error: any) {
          console.error('Error fetching user profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
      setIsInitialized(true);
    });

    return unsubscribe;
  }, []);

  // Handle redirects after auth state is determined
  useEffect(() => {
    if (!isInitialized || loading) return;

    console.log('Handling navigation - User:', user?.uid, 'Profile:', userProfile?.role);

    // Redirect logic
    if (!user) {
      // No user - redirect to register
      console.log('No user found, redirecting to /register');
      router.push('/register');
    } else if (!userProfile) {
      // User exists but no profile - something went wrong, redirect to register
      console.log('User exists but no profile, redirecting to /register');
      router.push('/register');
    } else {
      // User and profile exist - redirect based on role
      const redirectPath = getRedirectPath(userProfile);
      console.log(`User authenticated with role: ${userProfile.role}, redirecting to: ${redirectPath}`);
      
      // Only redirect if we're currently on auth pages
      const currentPath = window.location.pathname;
      const authPages = ['/register', '/login'];
      
      if (authPages.includes(currentPath)) {
        router.push(redirectPath);
      }
    }
  }, [user, userProfile, isInitialized, loading, router, getRedirectPath]);

  const signIn = async (email: string, password: string) => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }

    const trimmedEmail = email.trim().toLowerCase();
    console.log('Attempting sign in for:', trimmedEmail);
    
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      console.log('Sign in successful');
      // Redirect will be handled by useEffect
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      let userMessage;
      switch (error.code) {
        case 'auth/user-not-found':
          userMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          userMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          userMessage = 'Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          userMessage = 'This account has been disabled.';
          break;
        case 'auth/too-many-requests':
          userMessage = 'Too many failed attempts. Please try again later.';
          break;
        default:
          userMessage = 'Sign in failed. Please try again.';
      }
      
      throw new Error(userMessage);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profile: { firstName: string; lastName: string; phone: string; role: 'customer' | 'company_admin' }
  ) => {
    // Validation
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }
    if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
      throw new Error('First name and last name are required');
    }
    if (!profile.phone?.trim()) {
      throw new Error('Phone number is required');
    }
    if (!['customer', 'company_admin'].includes(profile.role)) {
      throw new Error('Valid role selection is required');
    }

    const trimmedEmail = email.trim().toLowerCase();
    console.log('Attempting sign up for:', trimmedEmail, 'with role:', profile.role);

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const newUser = userCredential.user;
      console.log('User account created, UID:', newUser.uid);

      // Create user profile document
      const userProfileData: Partial<UserProfile> = {
        id: newUser.uid,
        email: newUser.email || trimmedEmail,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone.trim(),
        role: profile.role,
        createdAt: serverTimestamp() as unknown as Date,
        updatedAt: serverTimestamp() as unknown as Date,
      };

      // Save to Firestore
      await setDoc(doc(db, 'users', newUser.uid), userProfileData);
      console.log('User profile saved to Firestore');

      // Profile will be loaded by the auth state listener
      // Redirect will be handled automatically based on role
      console.log('Sign up completed successfully');
      
    } catch (error: any) {
      console.error('Sign up error:', error);

      let userMessage;
      switch (error.code) {
        case 'auth/email-already-in-use':
          userMessage = 'An account with this email already exists.';
          break;
        case 'auth/invalid-email':
          userMessage = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          userMessage = 'Password should be at least 6 characters long.';
          break;
        case 'auth/operation-not-allowed':
          userMessage = 'Account creation is currently disabled.';
          break;
        default:
          userMessage = 'Account creation failed. Please try again.';
      }
      
      throw new Error(userMessage);
    }
  };

  const signOutUser = async () => {
    console.log('Attempting sign out');
    
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      console.log('Sign out successful');
      router.push('/register');
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error('Sign out failed. Please try again.');
    }
  };

  const contextValue: AuthContextType = {
    user,
    userProfile,
    setUserProfile,
    signIn,
    signUp,
    signOut: signOutUser,
    loading,
    refreshUserProfile,
  };

  // Show loading screen while determining auth state
  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading your account...</p>
          <p className="mt-1 text-sm text-gray-400">Please wait while we verify your credentials</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
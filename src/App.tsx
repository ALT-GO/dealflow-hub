// App entry
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { Layout } from "@/components/Layout";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import DealDetail from "./pages/DealDetail";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Settings from "./pages/Settings";
import Automations from "./pages/Automations";
import Performance from "./pages/Performance";
import EstimatorSchedule from "./pages/EstimatorSchedule";
import ProposalRequest from "./pages/ProposalRequest";
import FileLibrary from "./pages/FileLibrary";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RoleGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { canAccess } = usePagePermissions();
  if (!canAccess(path)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deals/:id" element={<DealDetail />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyDetail />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/settings" element={<RoleGuard path="/settings"><Settings /></RoleGuard>} />
        <Route path="/settings/automations" element={<RoleGuard path="/settings/automations"><Automations /></RoleGuard>} />
        <Route path="/performance" element={<RoleGuard path="/performance"><Performance /></RoleGuard>} />
        <Route path="/ocupacao" element={<EstimatorSchedule />} /> {/* Legacy redirect */}
        <Route path="/biblioteca" element={<FileLibrary />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/landing-page" element={<LandingPage />} />
            <Route path="/solicitar-proposta" element={<ProposalRequest />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

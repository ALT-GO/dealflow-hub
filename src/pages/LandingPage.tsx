import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Rocket } from 'lucide-react';

export default function LandingPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', role: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.company.trim()) {
      setError('Preencha os campos obrigatórios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('E-mail inválido.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('capture-lead', {
        body: form,
      });
      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
          <Rocket className="h-6 w-6 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">Orion CRM Hub</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-5xl w-full grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Copy */}
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground leading-tight">
              Transforme seus leads em{' '}
              <span className="text-primary">resultados reais</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Preencha o formulário e nossa equipe entrará em contato para entender suas necessidades e apresentar a melhor solução para o seu negócio.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> Sem compromisso
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> Resposta em 24h
              </span>
            </div>
          </div>

          {/* Right - Form */}
          <Card className="shadow-lg border-border">
            {submitted ? (
              <CardContent className="py-16 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-xl font-display font-bold text-foreground">Recebemos seus dados!</h2>
                <p className="text-muted-foreground text-sm">
                  Nossa equipe entrará em contato em breve.
                </p>
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="text-xl">Fale com um especialista</CardTitle>
                  <CardDescription>Preencha seus dados para receber uma proposta personalizada.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        placeholder="Seu nome completo"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        maxLength={255}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Empresa *</Label>
                      <Input
                        id="company"
                        placeholder="Nome da empresa"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Cargo</Label>
                      <Input
                        id="role"
                        placeholder="Ex: Diretor Comercial"
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        maxLength={100}
                      />
                    </div>
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Orion CRM Hub. Todos os direitos reservados.
      </footer>
    </div>
  );
}

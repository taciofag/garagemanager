import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { useAuth } from '../context/AuthContext';

interface LoginForm {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const { register, handleSubmit } = useForm<LoginForm>({
    defaultValues: { email: 'admin@garage.local' },
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      await login(data.email, data.password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/garage.svg" alt="Garage" className="h-12 w-12" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Garage Manager</h1>
            <p className="text-sm text-slate-500">Acesse com seu usuário admin para continuar.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('email', { required: true })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('password', { required: true })}
            />
          </div>
          {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">admin@garage.local / change-me</p>
      </div>
    </div>
  );
};

export default Login;

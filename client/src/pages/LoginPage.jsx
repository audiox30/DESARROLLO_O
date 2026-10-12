import React, { useState } from 'react';
import { 
  Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, 
  CheckCircle2, KeyRound, Sparkles, Building2, ArrowRight
} from 'lucide-react';
import { api, setAuthToken } from '../api/client';
import logoJama from '../assets/logo-jama.png';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estado para modal obligatorio de cambio de clave en primer inicio
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [tempUser, setTempUser] = useState(null);
  const [tempToken, setTempToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor ingresa tu número de nómina, usuario o correo, y tu contraseña.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(username.trim(), password);

      if (res.success && res.token) {
        // Si el usuario requiere cambiar su contraseña obligatoriamente (primer ingreso)
        if (res.debeCambiarPassword || res.user?.debeCambiarPassword) {
          setTempUser(res.user);
          setTempToken(res.token);
          // Establecer token temporal para poder consumir el endpoint de cambiar contraseña
          setAuthToken(res.token, res.user.idUsuario || res.user.idColaborador);
          setMustChangePassword(true);
          return;
        }

        // Login exitoso regular
        setAuthToken(res.token, res.user.idUsuario || res.user.idColaborador);
        localStorage.setItem('jama_vacaciones_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Credenciales inválidas. Verifica tu usuario y contraseña.');
      }
    } catch (err) {
      console.error('[login error]', err);
      setError(err.message || 'Error al conectar con el servidor. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCambiarPasswordSubmit(e) {
    e.preventDefault();
    setChangeError('');

    if (!newPassword || newPassword.length < 8) {
      setChangeError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeError('La confirmación de la contraseña no coincide.');
      return;
    }

    if (newPassword === password) {
      setChangeError('La nueva contraseña debe ser distinta a la clave temporal anterior.');
      return;
    }

    try {
      setChangeLoading(true);
      const res = await api.cambiarPassword({
        passwordActual: password,
        passwordNuevo: newPassword
      });

      if (res.success) {
        // Clave actualizada exitosamente
        const updatedUser = { ...tempUser, debeCambiarPassword: false };
        localStorage.setItem('jama_vacaciones_user', JSON.stringify(updatedUser));
        setMustChangePassword(false);
        onLoginSuccess(updatedUser);
      } else {
        setChangeError(res.error || 'No se pudo actualizar la contraseña.');
      }
    } catch (err) {
      setChangeError(err.message || 'Error al actualizar contraseña.');
    } finally {
      setChangeLoading(false);
    }
  }

  function handleQuickFill(userVal, passVal) {
    setUsername(userVal);
    setPassword(passVal);
    setError('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      {/* Encabezado y Marca Oficial */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center bg-white px-6 py-3.5 rounded-2xl shadow-xl mb-4 border border-slate-100">
          <img
            src={logoJama}
            alt="Grupo JAMA"
            className="h-10 w-auto object-contain select-none"
            style={{ aspectRatio: '192 / 48' }}
          />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">
          Control de Vacaciones
        </h2>
        <p className="mt-1 text-xs font-medium text-slate-300">
          Desarrollo Organizacional • Grupo JAMA (On-Premise)
        </p>
      </div>

      {/* Tarjeta de Formulario Principal */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Mensaje de Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {/* Campo Usuario / Nómina */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Número de Nómina, Correo o Usuario
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: sistemas, 0906, 850, 1077"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white focus:border-blue-600 transition"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contraseña
                </label>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white focus:border-blue-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Envío */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Acceso Rápido para Pruebas / Demostración de Roles */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-3">
              Cuentas Rápidas para Validación de Roles
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('sistemas', 'Sistemas2026!')}
                className="flex flex-col text-left p-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 transition"
              >
                <span className="font-bold text-purple-900">Sistemas / TI</span>
                <span className="text-[10px] text-purple-600">SuperAdmin (Acceso total)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin.do', 'Grupojama2026!')}
                className="flex flex-col text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
              >
                <span className="font-bold text-blue-900">Desarrollo Org.</span>
                <span className="text-[10px] text-blue-600">Admin DO (VoBo y Nóminas)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('lider.ulises', 'Grupojama2026!')}
                className="flex flex-col text-left p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
              >
                <span className="font-bold text-amber-900">Líder / Jefe</span>
                <span className="text-[10px] text-amber-600">Ulises Garcés (Equipo directo)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('colab.gonzalo', 'Grupojama2026!')}
                className="flex flex-col text-left p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                <span className="font-bold text-emerald-900">Colaborador</span>
                <span className="text-[10px] text-emerald-600">Gonzalo Ramírez (Operativo)</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer de Seguridad y Versión */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>Base de Datos: <span className="text-slate-200 font-semibold">DESARROLLO_O</span> (SQL Server)</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Autenticación Segura JWT • Cifrado Bcrypt • 8 Razones Sociales</p>
        </div>
      </div>

      {/* MODAL OBLIGATORIO: CAMBIO DE CONTRASEÑA EN PRIMER INGRESO */}
      {mustChangePassword && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <KeyRound className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Actualización Obligatoria</h3>
                <p className="text-xs text-slate-500">Primer ingreso al sistema detectado</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Por políticas de seguridad de Grupo JAMA, debes cambiar tu contraseña provisional por una clave personal segura antes de ingresar al sistema.
            </p>

            {changeError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{changeError}</span>
              </div>
            )}

            <form onSubmit={handleCambiarPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva Contraseña (mínimo 8 caracteres)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Introduce tu nueva contraseña"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={changeLoading}
                  className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {changeLoading ? 'Actualizando contraseña...' : 'Guardar y Continuar al Sistema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

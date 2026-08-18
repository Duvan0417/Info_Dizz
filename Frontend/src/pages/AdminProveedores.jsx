import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import PasswordInput from '../components/PasswordInput';
import api from '../utils/axiosConfig';

const ROLE_LABEL = { PROVEEDOR: 'Proveedor', SUPERVISOR: 'Supervisor', DIRECTOR: 'Director', ADMIN: 'Administrador' };
const CREATABLE_ROLES = ['PROVEEDOR', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const inputClass =
  'w-full box-border rounded-md border border-border bg-surface px-3 py-2 text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2';
const labelClass = 'flex flex-col items-start gap-1.5 text-sm text-text-h';
const buttonPrimaryClass =
  'inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4.5 py-2 text-[15px] font-medium text-accent-500 transition-colors hover:not-disabled:border-accent-border disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2';
const buttonSmallClass =
  'inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1 text-[13px] font-medium text-text-h transition-colors hover:border-accent-border hover:text-accent-500 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1';
const thClass = 'sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h';
const tdClass = 'border-b border-border px-3 py-2 text-left';
const resultTextClass = 'text-sm text-text';
const alertClass = 'm-0 text-sm text-danger';

export default function AdminProveedores() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedProveedores, setSelectedProveedores] = useState([]);
  const [selectedVendedores, setSelectedVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingVendedores, setSavingVendedores] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [vendedorMessage, setVendedorMessage] = useState('');

  const [newUser, setNewUser] = useState({ username: '', password: '', email: '', role: 'PROVEEDOR' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createMessage, setCreateMessage] = useState('');

  function loadUsers() {
    return api.get('/auth/admin/users/').then(({ data }) => setUsers(data));
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      loadUsers(),
      api.get('/mirror/proveedores/').then(({ data }) => setProveedores(data)),
      api.get('/mirror/vendedores/').then(({ data }) => setVendedores(data)),
    ])
      .catch(() => setError('No se pudo cargar la informacion.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateUser(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateMessage('');
    try {
      await api.post('/auth/admin/users/', newUser);
      await loadUsers();
      setNewUser({ username: '', password: '', email: '', role: 'PROVEEDOR' });
      setCreateMessage('Usuario creado.');
    } catch (err) {
      const detail = err.response?.data;
      setCreateError(detail ? Object.values(detail).flat().join(' ') : 'No se pudo crear el usuario.');
    } finally {
      setCreating(false);
    }
  }

  const [editingUserId, setEditingUserId] = useState('');
  const [editForm, setEditForm] = useState({ username: '', email: '', role: 'PROVEEDOR', password: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');
  const [deleteError, setDeleteError] = useState('');

  function handleStartEdit(user) {
    setEditingUserId(user.id);
    setEditForm({ username: user.username, email: user.email || '', role: user.role, password: '' });
    setEditError('');
  }

  function handleCancelEdit() {
    setEditingUserId('');
    setEditError('');
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    setEditSaving(true);
    setEditError('');
    try {
      const payload = { username: editForm.username, email: editForm.email, role: editForm.role };
      if (editForm.password) payload.password = editForm.password;
      await api.patch(`/auth/admin/users/${editingUserId}/`, payload);
      await loadUsers();
      setEditingUserId('');
    } catch (err) {
      const detail = err.response?.data;
      setEditError(detail ? Object.values(detail).flat().join(' ') : 'No se pudo guardar.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteUser(user) {
    if (!window.confirm(`¿Eliminar al usuario "${user.username}"? Esta acción no se puede deshacer.`)) return;
    setDeletingUserId(user.id);
    setDeleteError('');
    try {
      await api.delete(`/auth/admin/users/${user.id}/`);
      await loadUsers();
    } catch (err) {
      const detail = err.response?.data;
      setDeleteError(detail ? Object.values(detail).flat().join(' ') : 'No se pudo eliminar el usuario.');
    } finally {
      setDeletingUserId('');
    }
  }

  // Solo PROVEEDOR y SUPERVISOR se restringen por proveedor; DIRECTOR/ADMIN ven todo siempre.
  const scopedUsers = useMemo(() => users.filter((u) => u.role === 'PROVEEDOR' || u.role === 'SUPERVISOR'), [users]);
  const selectedUser = useMemo(
    () => scopedUsers.find((u) => String(u.id) === selectedUserId),
    [scopedUsers, selectedUserId],
  );
  const isSingleChoice = selectedUser?.role === 'PROVEEDOR';

  function handleSelectUser(id) {
    setSelectedUserId(id);
    setMessage('');
    setVendedorMessage('');
    const user = scopedUsers.find((u) => String(u.id) === id);
    setSelectedProveedores(user ? user.proveedores : []);
    setSelectedVendedores(user ? user.vendedores : []);
  }

  function toggleVendedor(vendedor) {
    setSelectedVendedores((current) =>
      current.includes(vendedor) ? current.filter((v) => v !== vendedor) : [...current, vendedor],
    );
  }

  async function handleSaveVendedores() {
    if (!selectedUser) return;
    setSavingVendedores(true);
    setError('');
    setVendedorMessage('');
    try {
      await api.put(`/auth/admin/users/${selectedUser.id}/vendedores/`, { vendedores: selectedVendedores });
      await loadUsers();
      setVendedorMessage('Guardado.');
    } catch {
      setError('No se pudo guardar la asignacion de vendedores.');
    } finally {
      setSavingVendedores(false);
    }
  }

  function toggleProveedor(proveedor) {
    if (isSingleChoice) {
      setSelectedProveedores([proveedor]);
      return;
    }
    setSelectedProveedores((current) =>
      current.includes(proveedor) ? current.filter((p) => p !== proveedor) : [...current, proveedor],
    );
  }

  const canSave = isSingleChoice ? selectedProveedores.length === 1 : true;

  async function handleSave() {
    if (!selectedUser || !canSave) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put(`/auth/admin/users/${selectedUser.id}/proveedores/`, { proveedores: selectedProveedores });
      await loadUsers();
      setMessage('Guardado.');
    } catch {
      setError('No se pudo guardar la asignacion.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={`${resultTextClass} px-6 py-8`}>Cargando...</p>;

  return (
    <div className="w-full flex-1 px-6 py-8 text-left">
      <h1 className="mb-6 text-2xl font-medium tracking-tight text-text-h sm:text-3xl">Administración</h1>

      <section className="mb-8 border-b border-border pb-6">
        <h2 className="mb-3 text-xl font-medium text-text-h">Crear usuario</h2>
        <form className="flex flex-row flex-wrap items-end gap-3" onSubmit={handleCreateUser}>
          <label className={labelClass}>
            Usuario
            <input
              type="text"
              value={newUser.username}
              onChange={(event) => setNewUser({ ...newUser, username: event.target.value })}
              required
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Contraseña
            <PasswordInput
              value={newUser.password}
              onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
              minLength={8}
              required
            />
          </label>
          <label className={labelClass}>
            Email
            <input
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Rol
            <select
              value={newUser.role}
              onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}
              className={inputClass}
            >
              {CREATABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={creating} className={buttonPrimaryClass}>
            {creating ? 'Creando...' : 'Crear'}
          </button>
        </form>
        {createError && <p className={`${alertClass} mt-3`}>{createError}</p>}
        {createMessage && <p className={`${resultTextClass} mt-3`}>{createMessage}</p>}
      </section>

      <section className="mb-8 border-b border-border pb-6">
        <h2 className="mb-3 text-xl font-medium text-text-h">Usuarios</h2>
        {deleteError && <p className={`${alertClass} mb-3`}>{deleteError}</p>}
        <div className="w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className={thClass}>Usuario</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>Rol</th>
                <th className={thClass}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Fragment key={user.id}>
                  <tr className="hover:bg-accent-soft">
                    <td className={tdClass}>{user.username}</td>
                    <td className={tdClass}>{user.email}</td>
                    <td className={tdClass}>{ROLE_LABEL[user.role]}</td>
                    <td className={`${tdClass} space-x-2`}>
                      <button type="button" onClick={() => handleStartEdit(user)} className={buttonSmallClass}>
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.id === currentUser?.id || deletingUserId === user.id}
                        title={user.id === currentUser?.id ? 'No puedes eliminar tu propia cuenta' : undefined}
                        className={buttonSmallClass}
                      >
                        {deletingUserId === user.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                  {editingUserId === user.id && (
                    <tr>
                      <td colSpan={4} className={`${tdClass} whitespace-normal bg-surface-muted/40`}>
                        <form className="flex flex-row flex-wrap items-end gap-3" onSubmit={handleSaveEdit}>
                          <label className={labelClass}>
                            Usuario
                            <input
                              type="text"
                              value={editForm.username}
                              onChange={(event) => setEditForm({ ...editForm, username: event.target.value })}
                              required
                              className={inputClass}
                            />
                          </label>
                          <label className={labelClass}>
                            Email
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                              className={inputClass}
                            />
                          </label>
                          <label className={labelClass}>
                            Rol
                            <select
                              value={editForm.role}
                              onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
                              className={inputClass}
                            >
                              {CREATABLE_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABEL[role]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={labelClass}>
                            Nueva contraseña
                            <PasswordInput
                              placeholder="dejar en blanco para no cambiarla"
                              value={editForm.password}
                              onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                              minLength={8}
                            />
                          </label>
                          <button type="submit" disabled={editSaving} className={buttonPrimaryClass}>
                            {editSaving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button type="button" onClick={handleCancelEdit} className={buttonSmallClass}>
                            Cancelar
                          </button>
                        </form>
                        {editError && <p className={`${alertClass} mt-3`}>{editError}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-medium text-text-h">Asignar proveedores y vendedores</h2>
        <p className={`${resultTextClass} mb-4 max-w-3xl`}>
          Proveedor: exactamente un proveedor asignado (obligatorio). Supervisor: puede tener varios proveedores y,
          además, vendedores (ambos se combinan: solo ve ventas que cumplan las dos condiciones). Sin ninguno
          asignado en una dimensión, no ve nada por esa dimensión.
        </p>

        {error && <p className={`${alertClass} mb-3`}>{error}</p>}

        <div className="mt-4 flex flex-wrap items-start gap-6">
          <div className="min-w-[220px]">
            <h3 className="mb-2 text-base font-medium text-text-h">Usuarios</h3>
            {scopedUsers.length === 0 ? (
              <p className={resultTextClass}>No hay usuarios con rol Proveedor o Supervisor.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {scopedUsers.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(String(user.id))}
                      className={
                        String(user.id) === selectedUserId
                          ? 'flex w-full items-center justify-between gap-2 rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-left text-accent-500'
                          : 'flex w-full items-center justify-between gap-2 rounded-md border border-border bg-transparent px-3 py-2 text-left text-text-h transition-colors hover:border-accent-border'
                      }
                    >
                      {user.username}
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text">
                        {ROLE_LABEL[user.role]} &middot; {user.proveedores.length} prov
                        {user.role === 'SUPERVISOR' && ` / ${user.vendedores.length} vend`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-[260px] flex-1">
            {!selectedUser ? (
              <p className={resultTextClass}>Selecciona un usuario para ver y editar sus proveedores asignados.</p>
            ) : (
              <>
                <h3 className="mb-2 text-base font-medium text-text-h">
                  Proveedores de {selectedUser.username} ({ROLE_LABEL[selectedUser.role]})
                </h3>
                {isSingleChoice && <p className={`${resultTextClass} mb-2`}>Elige exactamente un proveedor.</p>}
                <div className="my-3 flex max-h-[400px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-border px-4 py-2.5">
                  {proveedores.map((proveedor) => (
                    <label key={proveedor} className="flex flex-row items-center gap-2 text-sm text-text-h">
                      <input
                        type={isSingleChoice ? 'radio' : 'checkbox'}
                        name="proveedor-unico"
                        checked={selectedProveedores.includes(proveedor)}
                        onChange={() => toggleProveedor(proveedor)}
                        className="w-auto accent-accent-500"
                      />
                      {proveedor}
                    </label>
                  ))}
                </div>
                {isSingleChoice && !canSave && <p className={alertClass}>Debes elegir un proveedor.</p>}
                {message && <p className={resultTextClass}>{message}</p>}
                <button type="button" onClick={handleSave} disabled={saving || !canSave} className={`${buttonPrimaryClass} mt-2`}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>

                {selectedUser.role === 'SUPERVISOR' && (
                  <>
                    <h3 className="mt-6 mb-2 text-base font-medium text-text-h">Vendedores de {selectedUser.username}</h3>
                    <div className="my-3 flex max-h-[400px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-border px-4 py-2.5">
                      {vendedores.map((vendedor) => (
                        <label key={vendedor} className="flex flex-row items-center gap-2 text-sm text-text-h">
                          <input
                            type="checkbox"
                            checked={selectedVendedores.includes(vendedor)}
                            onChange={() => toggleVendedor(vendedor)}
                            className="w-auto accent-accent-500"
                          />
                          {vendedor}
                        </label>
                      ))}
                    </div>
                    {vendedorMessage && <p className={resultTextClass}>{vendedorMessage}</p>}
                    <button type="button" onClick={handleSaveVendedores} disabled={savingVendedores} className={`${buttonPrimaryClass} mt-2`}>
                      {savingVendedores ? 'Guardando...' : 'Guardar vendedores'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

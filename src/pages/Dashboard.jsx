import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import SuccessModal from "../components/SuccessModal.jsx";
import { fmt, toInputDateTime, fromInputDateTime } from "../utils";

const emptyForm = {
  name: "",
  teacher: "",
  startDate: "",
  endDate: "",
  // séances (count + date/time) are defined per group
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // workshop being edited
  const [form, setForm] = useState(emptyForm);
  const [showPwd, setShowPwd] = useState(false);
  const [confirm, setConfirm] = useState(null); // {title, message, ...}
  const [success, setSuccess] = useState(""); // success message

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/workshops");
    setWorkshops(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (w, e) => {
    e.stopPropagation();
    setEditing(w);
    setForm({
      name: w.name,
      teacher: w.teacher || "",
      startDate: toInputDateTime(w.startDate),
      endDate: toInputDateTime(w.endDate),
    });
    setShowForm(true);
  };

  const doSave = async () => {
    const wasEditing = !!editing;
    const payload = {
      ...form,
      startDate: fromInputDateTime(form.startDate),
      endDate: fromInputDateTime(form.endDate),
    };
    if (wasEditing) {
      await api.put(`/workshops/${editing._id}`, payload);
    } else {
      await api.post("/workshops", payload);
    }
    setConfirm(null);
    setShowForm(false);
    setSuccess(
      wasEditing
        ? "Workshop updated successfully."
        : "Workshop created successfully."
    );
    load();
  };

  const save = (e) => {
    e.preventDefault();
    if (editing) {
      // confirm before applying an update
      setConfirm({
        title: "Update workshop",
        message: `Save changes to "${form.name}"?`,
        confirmLabel: "Save changes",
        onConfirm: doSave,
      });
    } else {
      doSave();
    }
  };

  const remove = (w, e) => {
    e.stopPropagation();
    setConfirm({
      title: "Delete workshop",
      message: `Delete "${w.name}" and all its groups & participants? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/workshops/${w._id}`);
        setConfirm(null);
        setSuccess("Workshop deleted successfully.");
        load();
      },
    });
  };

  return (
    <div className="page">
      <header className="topbar">
        <h2>Workshops</h2>
        <div className="topbar-actions">
          <span className="muted">👤 {user?.username}</span>
          <button className="btn" onClick={() => setShowPwd(true)}>
            Reset password
          </button>
          <button className="btn" onClick={logout}>
            Logout
          </button>
          <button className="btn primary" onClick={openCreate}>
            + New Workshop
          </button>
        </div>
      </header>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : workshops.length === 0 ? (
        <div className="empty">No workshops yet. Create your first one!</div>
      ) : (
        <div className="cards">
          {workshops.map((w) => (
            <div
              key={w._id}
              className="card workshop-card"
              onClick={() => navigate(`/workshop/${w._id}`)}
            >
              <h3>{w.name}</h3>
              <div className="card-row">👩‍🏫 {w.teacher || "No teacher"}</div>
              <div className="card-row">🟢 {fmt(w.startDate)}</div>
              <div className="card-row">🔴 {fmt(w.endDate)}</div>
              <div className="badges">
                <span className="badge">{w.groupCount} groups</span>
                <span className="badge">{w.participantCount} participants</span>
              </div>
              <div className="card-actions">
                <button className="btn small" onClick={(e) => openEdit(w, e)}>
                  Edit
                </button>
                <button
                  className="btn small danger"
                  onClick={(e) => remove(w, e)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? "Edit Workshop" : "New Workshop"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="form">
            <label>Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <label>Teacher</label>
            <input
              value={form.teacher}
              onChange={(e) => setForm({ ...form, teacher: e.target.value })}
            />
            <div className="grid2">
              <div>
                <label>Start date &amp; time</label>
                <input
                  type="datetime-local"
                  required
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label>End date &amp; time</label>
                <input
                  type="datetime-local"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <p className="hint">
              Séances (how many &amp; their date/time) are set per group after
              you create the workshop.
            </p>
            <div className="modal-foot">
              <button
                type="button"
                className="btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button className="btn primary">
                {editing ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPwd && <ResetPassword onClose={() => setShowPwd(false)} />}

      {confirm && (
        <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />
      )}

      {success && (
        <SuccessModal message={success} onClose={() => setSuccess("")} />
      )}
    </div>
  );
}

function ResetPassword({ onClose }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api.post("/auth/reset-password", { currentPassword, newPassword });
      setMsg("Password updated successfully");
      setCurrent("");
      setNew("");
    } catch (e) {
      setErr(e.response?.data?.message || "Failed to update password");
    }
  };

  return (
    <Modal title="Reset password" onClose={onClose}>
      <form onSubmit={submit} className="form">
        {msg && <div className="alert ok">{msg}</div>}
        {err && <div className="alert">{err}</div>}
        <label>Current password</label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <label>New password</label>
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
        />
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button className="btn primary">Update</button>
        </div>
      </form>
    </Modal>
  );
}

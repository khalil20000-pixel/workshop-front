import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import Modal from "../components/Modal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import SuccessModal from "../components/SuccessModal.jsx";
import { fmt, toInputDateTime, fromInputDateTime } from "../utils";

export default function WorkshopDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // modal state
  const [workshopModal, setWorkshopModal] = useState(false);
  const [groupModal, setGroupModal] = useState(null); // {mode:'add'|'edit', group?}
  const [partModal, setPartModal] = useState(null); // {groupId, participant?}
  const [presenceModal, setPresenceModal] = useState(null); // {participant, group}
  const [confirm, setConfirm] = useState(null); // confirmation dialog config
  const [success, setSuccess] = useState(""); // success message

  const load = async () => {
    const { data } = await api.get(`/workshops/${id}`);
    setData(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <div className="center muted">Loading…</div>;
  if (!data) return <div className="center">Workshop not found.</div>;

  const { workshop, groups, participants } = data;

  const participantsOf = (groupId) =>
    participants.filter((p) => p.group === groupId);

  // ---- status / paid (optimistic local update) ----
  const updateParticipant = async (participant, patch) => {
    setData((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((x) => x._id === participant._id);
      Object.assign(p, patch);
      return next;
    });
    try {
      await api.put(`/participants/${participant._id}`, patch);
    } catch {
      load();
    }
  };

  // ---- attendance (optimistic local update) ----
  const setAttendance = async (participant, seance, patch) => {
    // optimistic update
    setData((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((x) => x._id === participant._id);
      let entry = p.attendance.find((a) => a.seance === seance);
      if (!entry) {
        entry = { seance, present: false, attendedGroup: null };
        p.attendance.push(entry);
      }
      Object.assign(entry, patch);
      return next;
    });
    try {
      await api.put(`/participants/${participant._id}/attendance`, {
        seance,
        ...patch,
      });
    } catch {
      load(); // revert from server on failure
    }
  };

  const deleteGroup = (g) => {
    setConfirm({
      title: "Delete group",
      message: `Delete group "${g.name}" and its participants? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/groups/${g._id}`);
        setConfirm(null);
        setSuccess("Group deleted successfully.");
        load();
      },
    });
  };

  const deleteParticipant = (p) => {
    setConfirm({
      title: "Remove participant",
      message: `Remove participant "${p.name}"? This cannot be undone.`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/participants/${p._id}`);
        setConfirm(null);
        setSuccess("Participant removed successfully.");
        load();
      },
    });
  };

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <Link to="/" className="back">
            ← Back
          </Link>
          <h2>{workshop.name}</h2>
          <div className="muted">
            👩‍🏫 {workshop.teacher || "No teacher"} · {fmt(workshop.startDate)} →{" "}
            {fmt(workshop.endDate)}
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => setWorkshopModal(true)}>
            Edit Workshop
          </button>
          <button
            className="btn primary"
            onClick={() => setGroupModal({ mode: "add" })}
          >
            + Add Group
          </button>
        </div>
      </header>

      {groups.length === 0 && (
        <div className="empty">No groups yet. Add a group to get started.</div>
      )}

      {groups.map((g) => {
        const members = participantsOf(g._id);
        // this group's own séances (count + dates)
        const seances = Array.from(
          { length: g.seances?.length || 0 },
          (_, i) => i + 1
        );
        return (
          <div className="group-block" key={g._id}>
            <div className="group-head">
              <div>
                <h3>{g.name}</h3>
                <span className="muted">
                  👩‍🏫 {g.teacher || workshop.teacher || "—"} · {seances.length}{" "}
                  séances
                </span>
              </div>
              <div className="group-actions">
                <button
                  className="btn small"
                  onClick={() => setPartModal({ groupId: g._id })}
                >
                  + Add Participant
                </button>
                <button
                  className="btn small"
                  onClick={() => setGroupModal({ mode: "edit", group: g })}
                >
                  Edit Group
                </button>
                <button
                  className="btn small danger"
                  onClick={() => deleteGroup(g)}
                >
                  Delete Group
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Paid</th>
                    {seances.map((s, i) => (
                      <th key={i} className="seance-col">
                        Séance {i + 1}
                        <div className="seance-date">
                          {fmt(g.seances?.[i]?.datetime)}
                        </div>
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={6 + seances.length} className="muted center">
                        No participants in this group yet.
                      </td>
                    </tr>
                  )}
                  {members.map((p, idx) => (
                    <tr key={p._id}>
                      <td>{idx + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.phone || "—"}</td>
                      <td>
                        <select
                          className={`status-select status-${p.status}`}
                          value={p.status}
                          onChange={(e) =>
                            updateParticipant(p, { status: e.target.value })
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="center">
                        <input
                          type="checkbox"
                          title="Paid to attend"
                          checked={!!p.paid}
                          onChange={(e) =>
                            updateParticipant(p, { paid: e.target.checked })
                          }
                        />
                      </td>
                      {seances.map((s, si) => {
                        const seanceNum = si + 1;
                        const a =
                          p.attendance.find((x) => x.seance === seanceNum) || {};
                        const elsewhere =
                          a.attendedGroup && a.attendedGroup !== g._id;
                        return (
                          <td key={si} className="seance-cell">
                            <input
                              type="checkbox"
                              checked={!!a.present}
                              onChange={(e) =>
                                setAttendance(p, seanceNum, {
                                  present: e.target.checked,
                                })
                              }
                            />
                            <select
                              className="grp-select"
                              title="Group attended for this séance"
                              value={a.attendedGroup || g._id}
                              onChange={(e) =>
                                setAttendance(p, seanceNum, {
                                  attendedGroup:
                                    e.target.value === g._id
                                      ? null
                                      : e.target.value,
                                })
                              }
                            >
                              <option value={g._id}>own group</option>
                              {groups
                                .filter((og) => og._id !== g._id)
                                .map((og) => (
                                  <option key={og._id} value={og._id}>
                                    {og.name}
                                  </option>
                                ))}
                            </select>
                            {elsewhere && (
                              <span
                                className="elsewhere-flag"
                                title="Attended in another group"
                              >
                                ⤴
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="row-actions">
                        <button
                          className="btn tiny"
                          onClick={() =>
                            setPresenceModal({ participant: p, group: g })
                          }
                        >
                          Presence
                        </button>
                        <button
                          className="btn tiny"
                          onClick={() =>
                            setPartModal({ groupId: g._id, participant: p })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="btn tiny danger"
                          onClick={() => deleteParticipant(p)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {workshopModal && (
        <WorkshopModal
          workshop={workshop}
          requestConfirm={setConfirm}
          onClose={() => setWorkshopModal(false)}
          onSaved={(msg, updatedWorkshop) => {
            setConfirm(null);
            setWorkshopModal(false);
            // Reflect the saved values in the header immediately, straight from
            // the API response — no waiting on (or trusting) a reload/cache.
            if (updatedWorkshop) {
              setData((prev) => ({ ...prev, workshop: updatedWorkshop }));
            }
            setSuccess(msg);
            load();
          }}
        />
      )}

      {groupModal && (
        <GroupModal
          workshopId={workshop._id}
          data={groupModal}
          requestConfirm={setConfirm}
          onClose={() => setGroupModal(null)}
          onSaved={(msg) => {
            setConfirm(null);
            setGroupModal(null);
            setSuccess(msg);
            load();
          }}
        />
      )}

      {partModal && (
        <ParticipantModal
          workshopId={workshop._id}
          groupId={partModal.groupId}
          participant={partModal.participant}
          requestConfirm={setConfirm}
          onClose={() => setPartModal(null)}
          onSaved={(msg) => {
            setConfirm(null);
            setPartModal(null);
            setSuccess(msg);
            load();
          }}
        />
      )}

      {presenceModal && (
        <PresenceModal
          participant={
            // always read the freshest participant from state
            participants.find((x) => x._id === presenceModal.participant._id) ||
            presenceModal.participant
          }
          group={presenceModal.group}
          onToggle={(seanceNum, present) =>
            setAttendance(presenceModal.participant, seanceNum, { present })
          }
          onClose={() => setPresenceModal(null)}
        />
      )}

      {confirm && (
        <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />
      )}

      {success && (
        <SuccessModal message={success} onClose={() => setSuccess("")} />
      )}
    </div>
  );
}

function WorkshopModal({ workshop, requestConfirm, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: workshop.name || "",
    teacher: workshop.teacher || "",
    startDate: toInputDateTime(workshop.startDate),
    endDate: toInputDateTime(workshop.endDate),
  });

  const submit = (e) => {
    e.preventDefault();
    requestConfirm({
      title: "Update workshop",
      message: `Save changes to "${form.name}"?`,
      confirmLabel: "Save changes",
      onConfirm: async () => {
        const { data: updated } = await api.put(`/workshops/${workshop._id}`, {
          ...form,
          startDate: fromInputDateTime(form.startDate),
          endDate: fromInputDateTime(form.endDate),
        });
        onSaved("Workshop updated successfully.", updated);
      },
    });
  };

  return (
    <Modal title="Edit Workshop" onClose={onClose}>
      <form onSubmit={submit} className="form">
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
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
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
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save changes</button>
        </div>
      </form>
    </Modal>
  );
}

function PresenceModal({ participant, group, onToggle, onClose }) {
  const seances = group.seances || [];
  const isPresent = (seanceNum) =>
    !!participant.attendance?.find((a) => a.seance === seanceNum)?.present;

  return (
    <Modal title={`Presence — ${participant.name}`} onClose={onClose}>
      <p className="hint">
        Tick the séance dates this participant attended (assisted).
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {seances.length === 0 && (
          <p className="muted">This group has no séances yet.</p>
        )}
        {seances.map((s, i) => {
          const seanceNum = i + 1;
          return (
            <label
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isPresent(seanceNum)}
                onChange={(e) => onToggle(seanceNum, e.target.checked)}
              />
              <span>
                <strong>Séance {seanceNum}</strong>
                <span className="muted"> — {fmt(s.datetime)}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function GroupModal({ workshopId, data, requestConfirm, onClose, onSaved }) {
  const editing = data.mode === "edit";
  const g = data.group || {};
  const [name, setName] = useState(g.name || "");
  const [teacher, setTeacher] = useState(g.teacher || "");
  // one datetime-local string per séance; this group decides how many it has
  const [seanceDates, setSeanceDates] = useState(() =>
    (g.seances?.length ? g.seances : [{}]).map((s) =>
      toInputDateTime(s?.datetime)
    )
  );

  const setSeanceDate = (i, value) =>
    setSeanceDates((prev) => prev.map((d, idx) => (idx === i ? value : d)));

  // Resize the séance list, keeping existing datetime values.
  const setSeanceCount = (count) => {
    const n = Math.max(1, Number(count) || 1);
    setSeanceDates((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      name,
      teacher,
      seances: seanceDates.map((d) => ({ datetime: fromInputDateTime(d) })),
    };
    const performSave = async () => {
      if (editing) {
        await api.put(`/groups/${g._id}`, payload);
      } else {
        await api.post("/groups", { ...payload, workshop: workshopId });
      }
      onSaved(
        editing ? "Group updated successfully." : "Group added successfully."
      );
    };
    if (editing) {
      requestConfirm({
        title: "Update group",
        message: `Save changes to "${name}"?`,
        confirmLabel: "Save changes",
        onConfirm: performSave,
      });
    } else {
      performSave();
    }
  };

  return (
    <Modal title={editing ? "Edit Group" : "Add Group"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>Group name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label>Teacher</label>
        <input
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
        />
        <label>Number of séances (sessions)</label>
        <input
          type="number"
          min="1"
          required
          value={seanceDates.length}
          onChange={(e) => setSeanceCount(e.target.value)}
        />
        <label>Date &amp; time of each séance</label>
        <div className="seance-dates">
          {seanceDates.map((d, i) => (
            <div key={i} className="seance-date-row">
              <span className="seance-date-label">Séance {i + 1}</span>
              <input
                type="datetime-local"
                value={d}
                onChange={(e) => setSeanceDate(i, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">
            {editing ? "Save" : "Add Group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ParticipantModal({
  workshopId,
  groupId,
  participant,
  requestConfirm,
  onClose,
  onSaved,
}) {
  const editing = !!participant;
  const [form, setForm] = useState({
    name: participant?.name || "",
    phone: participant?.phone || "",
    status: participant?.status || "pending",
    paid: participant?.paid || false,
  });

  const submit = (e) => {
    e.preventDefault();
    const performSave = async () => {
      if (editing) {
        await api.put(`/participants/${participant._id}`, form);
      } else {
        await api.post("/participants", {
          ...form,
          workshop: workshopId,
          group: groupId,
        });
      }
      onSaved(
        editing
          ? "Participant updated successfully."
          : "Participant added successfully."
      );
    };
    if (editing) {
      requestConfirm({
        title: "Update participant",
        message: `Save changes to "${form.name}"?`,
        confirmLabel: "Save changes",
        onConfirm: performSave,
      });
    } else {
      performSave();
    }
  };

  return (
    <Modal
      title={editing ? "Edit Participant" : "Add Participant"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <label>Phone number</label>
        <input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <label>Status</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.paid}
            onChange={(e) => setForm({ ...form, paid: e.target.checked })}
          />
          Paid to attend
        </label>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">{editing ? "Save" : "Add"}</button>
        </div>
      </form>
    </Modal>
  );
}

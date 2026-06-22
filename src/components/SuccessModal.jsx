import Modal from "./Modal.jsx";

export default function SuccessModal({ title = "Success", message, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="success-modal">
        <div className="success-icon">✓</div>
        <p>{message}</p>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn primary" onClick={onClose}>
          OK
        </button>
      </div>
    </Modal>
  );
}

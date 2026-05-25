import styles from './LoadingSpinner.module.css';

export function LoadingSpinner(): JSX.Element {
  return (
    <div
      className={styles.layoutBox}
      role="status"
      aria-label="Cargando..."
    >
      <span />
      <span />
      <span />
    </div>
  );
}

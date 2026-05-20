// import { useMemo, useRef, useState } from 'react';
// import type { FilterValues } from '../../../types/reservation';
// import { validateFilterForm } from '../../../utils/reservationValidator';
// import styles from './FilterPanel.module.css';

// interface FilterPanelProps {
//   values: FilterValues;
//   onChange: (values: FilterValues) => void;
//   onSearch: () => void;
//   isLoading: boolean;
//   availableCategories?: string[] | null;
// }

// const ALL_CATEGORIES: { value: string; label: string }[] = [
//   { value: 'escritorio', label: 'Escritorio' },
//   { value: 'colaborativo', label: 'Colaborativo' },
//   { value: 'work_lab', label: 'Work Lab' },
//   { value: 'phone_booth', label: 'Phone Booth' },
//   { value: 'garage', label: 'Garage' },
// ];

// const today = new Date().toISOString().slice(0, 10);

// function generateHalfHourOptions(): { value: string; label: string }[] {
//   const options: { value: string; label: string }[] = [];

//   for (let hour = 7; hour <= 22; hour += 1) {
//     for (const minute of [0, 30]) {
//       if (hour === 22 && minute === 30) continue;
//       const hh = String(hour).padStart(2, '0');
//       const mm = String(minute).padStart(2, '0');
//       const value = `${hh}:${mm}`;
//       options.push({ value, label: value });
//     }
//   }

//   return options;
// }

// const TIME_OPTIONS = generateHalfHourOptions();

// function formatDateLabel(value: string): string {
//   if (!value) return 'Selecciona fecha';

//   const [year, month, day] = value.split('-').map(Number);
//   const date = new Date(year, month - 1, day);

//   return new Intl.DateTimeFormat('es-MX', {
//     weekday: 'short',
//     day: 'numeric',
//     month: 'short',
//   }).format(date);
// }

// export function FilterPanel({
//   values,
//   onChange,
//   onSearch,
//   isLoading,
//   availableCategories,
// }: FilterPanelProps): JSX.Element {
//   const [errors, setErrors] = useState<Record<string, string>>({});
//   const dateInputRef = useRef<HTMLInputElement | null>(null);

//   const isEndTimeInvalid =
//     !!values.start_time && !!values.end_time && values.end_time <= values.start_time;

//   const filteredCategories = useMemo(() => {
//     return availableCategories
//       ? ALL_CATEGORIES.filter((c) => availableCategories.includes(c.value))
//       : ALL_CATEGORIES;
//   }, [availableCategories]);

//   function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();

//     const validationErrors = validateFilterForm(values);

//     if (isEndTimeInvalid) {
//       validationErrors.end_time = 'La hora fin debe ser posterior a la hora inicio.';
//     }

//     setErrors(validationErrors);

//     if (Object.keys(validationErrors).length === 0) {
//       onSearch();
//     }
//   }

//   function handleChange(field: keyof FilterValues, value: string | number | null) {
//     onChange({ ...values, [field]: value });

//     if (errors[field]) {
//       setErrors((prev) => {
//         const next = { ...prev };
//         delete next[field];
//         return next;
//       });
//     }

//     if (field === 'start_time' || field === 'end_time') {
//       setErrors((prev) => {
//         const next = { ...prev };
//         delete next.start_time;
//         delete next.end_time;
//         return next;
//       });
//     }
//   }

//   function handleDateFieldClick() {
//     const input = dateInputRef.current;
//     if (!input) return;

//     input.focus();

//     const pickerCapable = input as HTMLInputElement & { showPicker?: () => void };
//     if (typeof pickerCapable.showPicker === 'function') {
//       pickerCapable.showPicker();
//     } else {
//       input.click();
//     }
//   }

//   return (
//     <form className={styles.panel} onSubmit={handleSubmit} noValidate>
//       <div className={styles.header}>
//         <div>
//           <p className={styles.eyebrow}>Availability filters</p>
//           <h2 className={styles.title}>Buscar espacios</h2>
//         </div>

//         <button
//           type="submit"
//           className={styles.searchBtn}
//           disabled={isLoading || isEndTimeInvalid}
//         >
//           {isLoading ? 'Buscando...' : 'Buscar'}
//         </button>
//       </div>

//       <div className={styles.grid}>
//         <div className={styles.field}>
//           <label className={styles.label} htmlFor="filter-date">
//             Fecha
//           </label>

//           <button
//             type="button"
//             className={`${styles.dateButton} ${
//               errors.reservation_date ? styles.inputError : ''
//             }`}
//             onClick={handleDateFieldClick}
//           >
//             <span
//               className={`${styles.dateText} ${
//                 values.reservation_date ? styles.dateTextFilled : ''
//               }`}
//             >
//               {formatDateLabel(values.reservation_date)}
//             </span>

//             <span className={styles.dateIcon} aria-hidden="true" />

//             <input
//               ref={dateInputRef}
//               id="filter-date"
//               type="date"
//               className={styles.dateNativeInput}
//               value={values.reservation_date}
//               min={today}
//               onChange={(e) => handleChange('reservation_date', e.target.value)}
//               tabIndex={-1}
//             />
//           </button>

//           {errors.reservation_date && (
//             <span className={styles.errorMsg}>{errors.reservation_date}</span>
//           )}
//         </div>

//         <div className={styles.field}>
//           <label className={styles.label} htmlFor="filter-start">
//             Hora inicio
//           </label>
//           <select
//             id="filter-start"
//             className={`${styles.select} ${errors.start_time ? styles.inputError : ''}`}
//             value={values.start_time}
//             onChange={(e) => handleChange('start_time', e.target.value)}
//           >
//             <option value="">Selecciona hora</option>
//             {TIME_OPTIONS.map((option) => (
//               <option key={`start-${option.value}`} value={option.value}>
//                 {option.label}
//               </option>
//             ))}
//           </select>
//           {errors.start_time && (
//             <span className={styles.errorMsg}>{errors.start_time}</span>
//           )}
//         </div>

//         <div className={styles.field}>
//           <label className={styles.label} htmlFor="filter-end">
//             Hora fin
//           </label>
//           <select
//             id="filter-end"
//             className={`${styles.select} ${errors.end_time ? styles.inputError : ''}`}
//             value={values.end_time}
//             onChange={(e) => handleChange('end_time', e.target.value)}
//           >
//             <option value="">Selecciona hora</option>
//             {TIME_OPTIONS.map((option) => (
//               <option key={`end-${option.value}`} value={option.value}>
//                 {option.label}
//               </option>
//             ))}
//           </select>
//           {errors.end_time && (
//             <span className={styles.errorMsg}>{errors.end_time}</span>
//           )}
//         </div>

//         <div className={styles.field}>
//           <label className={styles.label} htmlFor="filter-floor">
//             Piso
//           </label>
//           <select
//             id="filter-floor"
//             className={styles.select}
//             value={values.floor_id ?? ''}
//             onChange={(e) => {
//               const raw = e.target.value;
//               handleChange('floor_id', raw === '' ? null : Number(raw));
//             }}
//           >
//             <option value="">Todos los pisos</option>
//             <option value="0">Planta Baja</option>
//             <option value="1">Mezzanine</option>
//             <option value="3">Piso 3</option>
//             <option value="9">Piso 9</option>
//           </select>
//         </div>

//         <div className={styles.field}>
//           <label className={styles.label} htmlFor="filter-category">
//             Zona
//           </label>
//           <select
//             id="filter-category"
//             className={styles.select}
//             value={values.priority_category ?? ''}
//             onChange={(e) => {
//               const raw = e.target.value;
//               handleChange('priority_category', raw === '' ? null : raw);
//             }}
//           >
//             <option value="">Todas las zonas</option>
//             {filteredCategories.map((c) => (
//               <option key={c.value} value={c.value}>
//                 {c.label}
//               </option>
//             ))}
//           </select>
//         </div>
//       </div>

//       {isEndTimeInvalid && (
//         <div className={styles.formMessage}>
//           La hora fin debe ser posterior a la hora inicio.
//         </div>
//       )}
//     </form>
//   );
// }


import { useMemo, useRef, useState } from 'react';
import type { FilterValues } from '../../../types/reservation';
import { validateFilterForm } from '../../../utils/reservationValidator';
import styles from './FilterPanel.module.css';

interface FilterPanelProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onSearch: () => void;
  isLoading: boolean;
  availableCategories?: string[] | null;
}

const ALL_CATEGORIES: { value: string; label: string }[] = [
  { value: 'escritorio', label: 'Escritorio' },
  { value: 'colaborativo', label: 'Colaborativo' },
  { value: 'work_lab', label: 'Work Lab' },
  { value: 'phone_booth', label: 'Phone Booth' },
  { value: 'garage', label: 'Garage' },
];

const today = new Date().toISOString().slice(0, 10);

function generateHalfHourOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];

  for (let hour = 7; hour <= 22; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === 22 && minute === 30) continue;
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      const value = `${hh}:${mm}`;
      options.push({ value, label: value });
    }
  }

  return options;
}

const TIME_OPTIONS = generateHalfHourOptions();

function formatDateLabel(value: string): string {
  if (!value) return 'Selecciona fecha';

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function FilterPanel({
  values,
  onChange,
  onSearch,
  availableCategories,
}: FilterPanelProps): JSX.Element {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const isEndTimeInvalid =
    !!values.start_time && !!values.end_time && values.end_time <= values.start_time;

  const filteredCategories = useMemo(() => {
    return availableCategories
      ? ALL_CATEGORIES.filter((c) => availableCategories.includes(c.value))
      : ALL_CATEGORIES;
  }, [availableCategories]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validateFilterForm(values);

    if (isEndTimeInvalid) {
      validationErrors.end_time = 'La hora fin debe ser posterior a la hora inicio.';
    }

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      onSearch();
    }
  }

  function handleChange(field: keyof FilterValues, value: string | number | null) {
    let updated = { ...values, [field]: value };

    // Auto-set end_time = start + 1hr when start changes and end is unset or invalid
    if (field === 'start_time' && typeof value === 'string' && value) {
      const [h, m] = value.split(':').map(Number);
      let endH = h + 1;
      const endM = m;
      if (endH > 22) endH = 22;
      const autoEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      if (!values.end_time || values.end_time <= value) {
        updated = { ...updated, end_time: autoEnd };
      }
    }

    onChange(updated);

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    if (field === 'start_time' || field === 'end_time') {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.start_time;
        delete next.end_time;
        return next;
      });
    }
  }

  function handleDateFieldClick() {
    const input = dateInputRef.current;
    if (!input) return;

    input.focus();

    const pickerCapable = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerCapable.showPicker === 'function') {
      pickerCapable.showPicker();
    } else {
      input.click();
    }
  }

  const dateFilled = !!values.reservation_date
  const startFilled = !!values.start_time
  const endFilled = !!values.end_time && !isEndTimeInvalid
  const zonaFilled = values.priority_category !== null

  return (
    <form className={styles.panel} onSubmit={handleSubmit} noValidate>
      <div className={styles.grid}>
        <div className={styles.field} data-tour="reservation-date-field">
          <label className={`${styles.label} ${dateFilled ? styles.labelFilled : ''}`} htmlFor="filter-date">
            Fecha{dateFilled && <span className={styles.check}>✓</span>}
          </label>

          <button
            type="button"
            className={`${styles.dateButton} ${dateFilled ? styles.dateButtonFilled : ''} ${
              errors.reservation_date ? styles.inputError : ''
            }`}
            onClick={handleDateFieldClick}
          >
            <span className={styles.dateText}>
              {formatDateLabel(values.reservation_date)}
            </span>

            <span className={`${styles.dateIcon} ${dateFilled ? styles.dateIconFilled : ''}`} aria-hidden="true" />

            <input
              ref={dateInputRef}
              id="filter-date"
              type="date"
              className={styles.dateNativeInput}
              value={values.reservation_date}
              min={today}
              onChange={(e) => handleChange('reservation_date', e.target.value)}
              tabIndex={-1}
            />
          </button>

          {errors.reservation_date && (
            <span className={styles.errorMsg}>{errors.reservation_date}</span>
          )}
        </div>

        <div className={styles.field} data-tour="reservation-start-field">
          <label className={`${styles.label} ${startFilled ? styles.labelFilled : ''}`} htmlFor="filter-start">
            Hora inicio{startFilled && <span className={styles.check}>✓</span>}
          </label>
          <select
            id="filter-start"
            className={`${styles.select} ${startFilled ? styles.selectFilled : ''} ${errors.start_time ? styles.inputError : ''}`}
            value={values.start_time}
            onChange={(e) => handleChange('start_time', e.target.value)}
          >
            <option value="">Selecciona hora</option>
            {TIME_OPTIONS.map((option) => (
              <option key={`start-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.start_time && (
            <span className={styles.errorMsg}>{errors.start_time}</span>
          )}
        </div>

        <div className={styles.field} data-tour="reservation-end-field">
          <label className={`${styles.label} ${endFilled ? styles.labelFilled : ''}`} htmlFor="filter-end">
            Hora fin{endFilled && <span className={styles.check}>✓</span>}
          </label>
          <select
            id="filter-end"
            className={`${styles.select} ${endFilled ? styles.selectFilled : ''} ${errors.end_time ? styles.inputError : ''}`}
            value={values.end_time}
            onChange={(e) => handleChange('end_time', e.target.value)}
          >
            <option value="">Selecciona hora</option>
            {TIME_OPTIONS.map((option) => (
              <option key={`end-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.end_time && (
            <span className={styles.errorMsg}>{errors.end_time}</span>
          )}
        </div>

        <div className={styles.field} data-tour="reservation-zone-field">
          <label className={`${styles.label} ${zonaFilled ? styles.labelFilled : ''}`} htmlFor="filter-category">
            Zona{zonaFilled && <span className={styles.check}>✓</span>}
          </label>
          <select
            id="filter-category"
            className={`${styles.select} ${zonaFilled ? styles.selectFilled : ''}`}
            value={values.priority_category ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              handleChange('priority_category', raw === '' ? null : raw);
            }}
          >
            <option value="">Todas las zonas</option>
            {filteredCategories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isEndTimeInvalid && (
        <div className={styles.formMessage}>
          La hora fin debe ser posterior a la hora inicio.
        </div>
      )}
    </form>
  );
}

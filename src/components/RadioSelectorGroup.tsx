export interface RadioOption<T extends string | number> {
  value: T;
  label: string;
}

export interface RadioSelectorGroupProps<T extends string | number> {
  legend: string;
  name: string;
  options: readonly RadioOption<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
}

/** Grupo accesible de opciones tipo radio con diseño táctil. */
export function RadioSelectorGroup<T extends string | number>({
  legend,
  name,
  options,
  selectedValue,
  onChange,
}: RadioSelectorGroupProps<T>) {
  return (
    <fieldset className="selector-group">
      <legend className="selector-legend">{legend}</legend>
      <div className="selector-options">
        {options.map((option) => {
          const isSelected = selectedValue === option.value;
          return (
            <label
              key={String(option.value)}
              className={`selector-pill ${isSelected ? 'selector-pill--selected' : ''}`.trim()}
            >
              <input
                type="radio"
                className="selector-pill__input"
                name={name}
                value={String(option.value)}
                checked={isSelected}
                onChange={() => onChange(option.value)}
              />
              <span className="selector-pill__label">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

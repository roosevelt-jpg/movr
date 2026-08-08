import React, { useEffect, useRef, useState } from 'react';
import { FormField, TextField, fieldClassName } from './FormField';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  '/api/v1';

export type VehicleCatalogValue = {
  make: string;
  model: string;
  makeId?: string | null;
  modelId?: string | null;
  year?: number | string | null;
  bodyStyle?: string | null;
  vehicleType?: string | null;
  color?: string;
  vin?: string;
  chassisNumber?: string;
  transmission?: string;
  fuelType?: string;
  plateNumber?: string;
};

type Props = {
  value: VehicleCatalogValue;
  onChange: (next: VehicleCatalogValue) => void;
  /** Show plate / color / type fields (driver + owner). */
  showExtras?: boolean;
  className?: string;
};

type SuggestRow = {
  kind: string;
  make: string;
  makeId: string;
  model: string | null;
  modelId: string | null;
  label: string;
  bodyStyle?: string | null;
};

/**
 * Global automobile catalog autocomplete — make, model, year, chassis/VIN decode.
 * Backed by GET /public/vehicles/* (NHTSA + local cache).
 */
export default function VehicleCatalogFields({
  value,
  onChange,
  showExtras = true,
  className = '',
}: Props) {
  const [makeQ, setMakeQ] = useState(value.make || '');
  const [modelQ, setModelQ] = useState(value.model || '');
  const [makes, setMakes] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<
    { id: string; name: string; bodyStyle?: string | null }[]
  >([]);
  const [years, setYears] = useState<number[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestRow[]>([]);
  const [vinMsg, setVinMsg] = useState('');
  const [decoding, setDecoding] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMakeQ(value.make || '');
    setModelQ(value.model || '');
  }, [value.make, value.model]);

  useEffect(() => {
    fetch(`${API}/public/vehicles/makes?limit=30`)
      .then((r) => r.json())
      .then((j) => setMakes(j.data || []))
      .catch(() => setMakes([]));
  }, []);

  useEffect(() => {
    if (!value.make) {
      setModels([]);
      setYears([]);
      return;
    }
    const q = new URLSearchParams({ make: value.make, limit: '50' });
    if (value.year) q.set('year', String(value.year));
    fetch(`${API}/public/vehicles/models?${q}`)
      .then((r) => r.json())
      .then((j) => setModels(j.data || []))
      .catch(() => setModels([]));
    fetch(
      `${API}/public/vehicles/years?make=${encodeURIComponent(value.make)}${
        value.model ? `&model=${encodeURIComponent(value.model)}` : ''
      }`
    )
      .then((r) => r.json())
      .then((j) => setYears(j.data || []))
      .catch(() => setYears([]));
  }, [value.make, value.model, value.year]);

  const searchSuggest = (text: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      fetch(`${API}/public/vehicles/suggest?q=${encodeURIComponent(text)}&limit=12`)
        .then((r) => r.json())
        .then((j) => {
          setSuggestions(j.data || []);
          setSuggestOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 200);
  };

  const applySuggest = (s: SuggestRow) => {
    onChange({
      ...value,
      make: s.make,
      model: s.model || value.model || '',
      makeId: s.makeId,
      modelId: s.modelId,
      bodyStyle: s.bodyStyle || value.bodyStyle,
      vehicleType: s.bodyStyle || value.vehicleType,
    });
    setMakeQ(s.make);
    setModelQ(s.model || '');
    setSuggestOpen(false);
  };

  const decodeVin = async () => {
    const vin = (value.chassisNumber || value.vin || '').trim();
    if (vin.length < 11) {
      setVinMsg('Enter at least 11 characters of the chassis / VIN');
      return;
    }
    setDecoding(true);
    setVinMsg('');
    try {
      const res = await fetch(
        `${API}/public/vehicles/decode-vin/${encodeURIComponent(vin)}`
      );
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setVinMsg(json.message || 'Could not decode chassis / VIN');
        return;
      }
      const d = json.data;
      onChange({
        ...value,
        make: d.make || value.make,
        model: d.model || value.model,
        makeId: d.makeId || value.makeId,
        modelId: d.modelId || value.modelId,
        year: d.year || value.year,
        bodyStyle: d.bodyStyle || value.bodyStyle,
        vehicleType: d.vehicleTypeHint || value.vehicleType,
        transmission: d.transmission || value.transmission,
        fuelType: d.fuelType || value.fuelType,
        vin: d.vin || vin,
        chassisNumber: d.vin || vin,
      });
      setMakeQ(d.make || value.make);
      setModelQ(d.model || value.model);
      setVinMsg(
        d.trim
          ? `Matched ${d.make} ${d.model} (${d.year})${d.trim ? ` · ${d.trim}` : ''}`
          : `Matched ${d.make} ${d.model}${d.year ? ` · ${d.year}` : ''}`
      );
    } catch (e: any) {
      setVinMsg(e.message || 'Decode failed');
    } finally {
      setDecoding(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <FormField
        label="Search make & model"
        hint="Type to search the global automobile database"
      >
        <div className="relative">
          <input
            className={fieldClassName}
            value={makeQ && modelQ ? `${makeQ} ${modelQ}` : makeQ || modelQ}
            onChange={(e) => {
              const t = e.target.value;
              searchSuggest(t);
              const parts = t.trim().split(/\s+/);
              setMakeQ(parts[0] || '');
              setModelQ(parts.slice(1).join(' '));
            }}
            onFocus={() => searchSuggest(makeQ || '')}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 180)}
            placeholder="e.g. Toyota Corolla"
            autoComplete="off"
          />
          {suggestOpen && suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-black/10 bg-white shadow-lg dark:bg-zinc-900 dark:border-white/10">
              {suggestions.map((s) => (
                <li key={`${s.kind}-${s.label}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggest(s)}
                  >
                    {s.label}
                    {s.bodyStyle ? (
                      <span className="text-text-secondary ml-2 text-xs">{s.bodyStyle}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Make">
          <select
            className={fieldClassName}
            value={value.make || ''}
            required
            onChange={(e) => {
              const name = e.target.value;
              const hit = makes.find((m) => m.name === name);
              onChange({
                ...value,
                make: name,
                makeId: hit?.id || null,
                model: '',
                modelId: null,
              });
              setMakeQ(name);
              setModelQ('');
            }}
          >
            <option value="">Select make</option>
            {makes.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
            {value.make && !makes.some((m) => m.name === value.make) ? (
              <option value={value.make}>{value.make}</option>
            ) : null}
          </select>
        </FormField>

        <FormField label="Model">
          <select
            className={fieldClassName}
            value={value.model || ''}
            disabled={!value.make}
            required
            onChange={(e) => {
              const name = e.target.value;
              const hit = models.find((m) => m.name === name);
              onChange({
                ...value,
                model: name,
                modelId: hit?.id || null,
                bodyStyle: hit?.bodyStyle || value.bodyStyle,
                vehicleType: hit?.bodyStyle || value.vehicleType,
              });
              setModelQ(name);
            }}
          >
            <option value="">{value.make ? 'Select model' : 'Pick a make first'}</option>
            {models.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
            {value.model && !models.some((m) => m.name === value.model) ? (
              <option value={value.model}>{value.model}</option>
            ) : null}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Year">
          <select
            className={fieldClassName}
            value={value.year || ''}
            onChange={(e) =>
              onChange({
                ...value,
                year: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">Select year</option>
            {(years.length
              ? years
              : Array.from({ length: 40 }, (_, i) => new Date().getFullYear() + 1 - i)
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </FormField>

        {showExtras ? (
          <TextField
            label="Color"
            value={value.color || ''}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
            placeholder="e.g. Silver"
          />
        ) : null}
      </div>

      <FormField
        label="Chassis / VIN"
        hint="Paste chassis number to auto-fill make, model, year from the global vehicle database"
      >
        <div className="flex gap-2">
          <input
            className={`${fieldClassName} flex-1 font-mono tracking-wide uppercase`}
            value={value.chassisNumber || value.vin || ''}
            onChange={(e) =>
              onChange({
                ...value,
                chassisNumber: e.target.value.toUpperCase(),
                vin: e.target.value.toUpperCase(),
              })
            }
            placeholder="e.g. JTDKN3DU…"
            maxLength={32}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={decodeVin}
            disabled={decoding}
            className="shrink-0 rounded-xl px-4 py-2.5 bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50"
          >
            {decoding ? 'Decoding…' : 'Autofill'}
          </button>
        </div>
        {vinMsg ? <p className="mt-1.5 text-xs text-text-secondary">{vinMsg}</p> : null}
      </FormField>

      {showExtras ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Plate number"
            value={value.plateNumber || ''}
            onChange={(e) => onChange({ ...value, plateNumber: e.target.value })}
            placeholder="GR-1234-26"
          />
          <FormField label="Vehicle type">
            <select
              className={fieldClassName}
              value={value.vehicleType || value.bodyStyle || ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  vehicleType: e.target.value,
                  bodyStyle: e.target.value,
                })
              }
            >
              <option value="">Auto from catalog</option>
              {['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Luxury', 'Motorcycle', 'Tricycle'].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
          </FormField>
          <TextField
            label="Transmission"
            value={value.transmission || ''}
            onChange={(e) => onChange({ ...value, transmission: e.target.value })}
            placeholder="Auto / Manual"
          />
          <TextField
            label="Fuel"
            value={value.fuelType || ''}
            onChange={(e) => onChange({ ...value, fuelType: e.target.value })}
            placeholder="Petrol / Diesel / Electric"
          />
        </div>
      ) : null}
    </div>
  );
}

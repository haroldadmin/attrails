"use client";

import { useRef } from "react";
import { resetUnits, saveUnits } from "@/i18n/actions";
import type { Units } from "@/i18n/units";

const LABELS = {
  kilometer: "Kilometers",
  mile: "Miles",
  meter: "Meters",
  foot: "Feet",
} satisfies Record<Units["distance"] | Units["elevation"], string>;

export type UnitsDialogProps = {
  units: Units;
};

export function UnitsDialog({ units }: UnitsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        className="link link-hover"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        Units
      </button>
      <dialog
        ref={dialogRef}
        className="modal"
        closedby="any"
        aria-labelledby="units-heading"
        aria-describedby="units-description"
        onClose={() => formRef.current?.reset()}
      >
        <form
          key={`${units.distance}-${units.elevation}`}
          ref={formRef}
          className="modal-box flex flex-col gap-4"
          action={async (formData) => {
            await saveUnits(formData);
            close();
          }}
        >
          <h2 id="units-heading" className="text-lg font-semibold">
            Units
          </h2>
          <p id="units-description" className="text-sm text-base-content/70">
            Choose how distances and elevations are shown across ATTrails.
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold mb-2">Distance</legend>
            <Choice
              name="distance"
              value="kilometer"
              label={LABELS.kilometer}
              checked={units.distance === "kilometer"}
            />
            <Choice
              name="distance"
              value="mile"
              label={LABELS.mile}
              checked={units.distance === "mile"}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold mb-2">Elevation</legend>
            <Choice
              name="elevation"
              value="meter"
              label={LABELS.meter}
              checked={units.elevation === "meter"}
            />
            <Choice
              name="elevation"
              value="foot"
              label={LABELS.foot}
              checked={units.elevation === "foot"}
            />
          </fieldset>
          <div className="modal-action mt-0 flex-wrap">
            <button
              type="submit"
              className="btn btn-ghost mr-auto"
              formAction={async () => {
                await resetUnits();
                close();
              }}
            >
              Use defaults for my language
            </button>
            <button type="button" className="btn btn-ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Choice({
  name,
  value,
  label,
  checked,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex flex-row items-center gap-3">
      <input
        type="radio"
        className="radio radio-primary"
        name={name}
        value={value}
        defaultChecked={checked}
        required
      />
      {label}
    </label>
  );
}

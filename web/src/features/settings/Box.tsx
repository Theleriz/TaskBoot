import type { ReactNode } from 'react';

/** A titled card used on the settings page. */
export function Box({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <section className="box settings-box">
      <div className="box-head">
        <span className="stripe" style={{ background: color }} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

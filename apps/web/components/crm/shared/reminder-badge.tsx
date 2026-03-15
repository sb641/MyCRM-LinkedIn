type ReminderBadgeProps = {
  label: string;
  tone: 'neutral' | 'warning' | 'danger' | 'success';
};

export function ReminderBadge({ label, tone }: ReminderBadgeProps) {
  return <span className={`crm-reminder-badge crm-reminder-badge--${tone}`}>{label}</span>;
}
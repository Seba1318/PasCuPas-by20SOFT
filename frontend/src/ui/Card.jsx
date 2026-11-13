// Card: suprafață albă, rază 20, umbră discretă (contur alb în contrast ridicat).
export default function Card({ as: Tag = 'article', className = '', children, ...rest }) {
  return (
    <Tag className={`rounded-card bg-surface p-6 shadow-md hc:border-2 hc:border-border ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

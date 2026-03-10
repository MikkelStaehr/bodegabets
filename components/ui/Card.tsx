type Props = React.HTMLAttributes<HTMLDivElement> & {
  as?: 'div' | 'section' | 'article'
  padding?: 'sm' | 'md' | 'lg'
}

const paddings = {
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export default function Card({
  as: Tag = 'div',
  padding = 'md',
  children,
  className = '',
  ...props
}: Props) {
  return (
    <Tag
      className={[
        'bg-cream-dark border border-warm-border rounded-sm',
        paddings[padding],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </Tag>
  )
}

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface AuthorLinkProps {
  name: string;
  className?: string;
}

export function AuthorLink({ name, className }: AuthorLinkProps) {
  return (
    <Link
      href={`/authors/${encodeURIComponent(name)}`}
      className={cn(
        'text-primary hover:underline',
        className
      )}
    >
      {name}
    </Link>
  );
}

interface AuthorLinksProps {
  authors: string[];
  className?: string;
}

export function AuthorLinks({ authors, className }: AuthorLinksProps) {
  if (authors.length === 0) {
    return <span className={className}>Not listed</span>;
  }

  return (
    <span className={className}>
      {authors.map((author, index) => (
        <span key={author}>
          <AuthorLink name={author} />
          {index < authors.length - 1 && ', '}
        </span>
      ))}
    </span>
  );
}

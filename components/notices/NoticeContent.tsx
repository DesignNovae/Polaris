import type { NoticeInput } from "@/lib/notices/schema";
import Image from "next/image";
import { CompassLogo } from "@/components/Nav";
import styles from "./notices.module.css";

export function NoticeContent({
  notice,
  date,
  includeAction = true,
}: {
  notice: NoticeInput;
  date?: string;
  includeAction?: boolean;
}) {
  return (
    <article className={styles.content}>
      <div className={styles.publisher}>
        {notice.logoUrl ? (
          <Image
            unoptimized
            src={notice.logoUrl}
            alt="Notice publisher logo"
            width={44}
            height={44}
          />
        ) : (
          <CompassLogo className="h-10 w-10" />
        )}
        <div>
          <strong>Polaris</strong>
          <span>{date || "Draft preview"}</span>
        </div>
      </div>
      <div className={styles.meta}>
        <span>{notice.category}</span>
        {notice.priority === "important" && <strong>Important</strong>}
      </div>
      <h2>{notice.title || "Your notice title"}</h2>
      <p className={styles.summary}>
        {notice.summary || "A short introduction to your notice."}
      </p>
      {notice.imageUrl && (
        <Image
          unoptimized
          className={styles.cover}
          src={notice.imageUrl}
          alt={notice.imageAlt || "Notice image preview"}
          width={1200}
          height={675}
        />
      )}
      <div className={styles.body}>
        {notice.body ||
          "The full notice appears here. Add the details your audience needs to know."}
      </div>
      {includeAction && notice.linkUrl && (
        <a
          className={styles.actionLink}
          href={notice.linkUrl}
          rel="noopener noreferrer"
        >
          {notice.linkLabel || "Learn more"}
          <span aria-hidden="true"> →</span>
        </a>
      )}
    </article>
  );
}

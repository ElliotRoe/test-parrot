---
status: accepted
---

# Organize Resources in Folders, and keep deletions in Trash for 30 days

Home was a shelf of recent Exams over a grid of every Question Bank (ADR-0016), with separate Exams and Question Banks lists. That stops working once a teacher has a few terms of material, and it splits two kinds of work they think of together. Teachers already know Google Drive, so Home now works the way Drive does: Exams and Question Banks are both Resources, kept together in Folders.

**Folders hold Resources and other Folders.** They nest to any depth, and every Resource and Folder sits in exactly one Folder or at the top level. There are no shortcuts that put one thing in two places. Each Folder has its own URL, so a teacher can bookmark it. Where something sits is organization only: it never changes which Questions an Exam references, what an export contains, or what a Test Parrot Package carries. Packages carry no Folders, and whatever is imported lands in the Folder the teacher is in. An Account Backup does carry Folders, Stars and Trash, because it is everything in the browser. Home is the top-level Folder, with no recent shelf; Recent, Starred and Trash are their own places in the navigation. The separate Exams and Question Banks lists are gone; Folders list first, then Resources, with no filter by type.

**Deleting a Resource or Folder moves it to Trash; it isn't gone for 30 days.** The warning counts what is going, by kind, and names the Exams that use Questions from any bank among it. After 30 days it is deleted for good, the next time Test Parrot is open. Until then, Restore puts it back in the Folder it came from, or at the top level if that Folder is gone too. A Question Bank in Trash changes nothing for the Exams using its Questions; they lose them only when the bank is deleted for good. An Exam goes to Trash with its Export History and cannot be opened until it is restored.

**Two things are unchanged.** Deleting a single Question inside a bank is still permanent, behind its confirmation. An untouched, empty Untitled Exam or Question Bank is still discarded silently, without passing through Trash.

**Considered options.** Deleting a Folder could have moved its contents up a level, or been allowed only once the Folder was empty. Both protect the teacher's work, but neither is what Drive users expect. Trash gives the same protection with the familiar behaviour.

This supersedes ADR-0016's Home layout and its separate `/exams` and `/question-banks` collections. It amends ADR-0047: deleting an Exam is now permanent only once it leaves Trash. Export Records stay immutable, and they are still deleted only with their Exam.

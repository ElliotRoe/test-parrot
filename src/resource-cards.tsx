import type { RecentExam } from './exam-workspaces'
import type { PageFurniture } from './export-plan'
import { DocView } from './doc-view'
import { PageHeaderContent } from './page-item-view'
import { PAGE_GEOMETRY } from './exam-page'

/** The sheet clips at one page, so a long Exam's later questions are drawn and
 *  then thrown away. Stop well past whatever a page can hold instead. */
const THUMBNAIL_QUESTIONS = 12

/** An Exam's first page, shrunk: the furniture it prints and the start of its
 *  Questions, from its Working Copy. */
export function ExamSheetPreview({ exam }: { exam: Pick<RecentExam, 'title' | 'preview'> }) {
  // The same furniture the first sheet actually prints. The thumbnail is a
  // real page at real geometry, shrunk — not an approximation of one — so an
  // Exam is recognised on the shelf by the shape of its own first page.
  const furniture: PageFurniture = {
    identityFields: ['Name', 'Class', 'Date'],
    title: exam.title,
    arrangementLabel: 'ID: A',
    pageNumber: 1,
  }
  return (
    <>
      {/* Decorative: everything it says, the caption and the label above say in
          a form a screen reader can use, and six miniature pages would
          otherwise put six `h1`s into the document outline. */}
      <div className="exam-sheet" aria-hidden="true">
        <div className="exam-page" style={PAGE_GEOMETRY}>
          <PageHeaderContent header="first" furniture={furniture} />
          <div className="page-content">
            {exam.preview ? (
              exam.preview.slice(0, THUMBNAIL_QUESTIONS).map((content, index) => (
                <section className="exam-question" key={index}>
                  <div className="question-number">
                    <span className="question-count">{index + 1}.</span>
                  </div>
                  <div className="question-body">
                    <DocView className="question-stem" content={content} />
                  </div>
                </section>
              ))
            ) : (
              <p className="empty-page-line">Empty Exam</p>
            )}
          </div>
          <footer className="page-footer">{furniture.pageNumber}</footer>
        </div>
      </div>
    </>
  )
}

"use client";

import { useParams } from "next/navigation";
import { QuestionEditor } from "@/components/QuestionEditor";

export default function EditQuestionPage() {
  const params = useParams<{ id: string }>();
  return <QuestionEditor mode="edit" questionId={params.id} />;
}

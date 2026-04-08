from article_studio.db.collections import get_collection


async def ensure_indexes() -> None:
    """确保所有索引已创建"""
    templates = get_collection("article_templates")
    template_versions = get_collection("article_template_versions")
    jobs = get_collection("article_jobs")
    documents = get_collection("article_documents")
    approvals = get_collection("article_approvals")
    ragflow_tasks = get_collection("article_ragflow_tasks")

    # article_templates 索引
    await templates.create_index("code", unique=True)
    await templates.create_index("status")
    await templates.create_index("category")
    await templates.create_index("updatedAt")

    # article_template_versions 索引
    await template_versions.create_index(
        [("templateId", 1), ("version", -1)],
        unique=True,
    )

    # article_jobs 索引
    await jobs.create_index("status")
    await jobs.create_index("userId")
    await jobs.create_index("templateId")
    await jobs.create_index("createdAt")

    # article_documents 索引
    await documents.create_index("jobId")
    await documents.create_index("templateId")
    await documents.create_index("approvalStatus")
    await documents.create_index("ragflowStatus")
    await documents.create_index("updatedAt")

    # article_approvals 索引
    await approvals.create_index("documentId")
    await approvals.create_index("status")
    await approvals.create_index("createdAt")

    # article_ragflow_tasks 索引
    await ragflow_tasks.create_index("status")
    await ragflow_tasks.create_index(
        [("documentId", 1), ("documentVersion", 1)],
        unique=True,
    )
    await ragflow_tasks.create_index("createdAt")

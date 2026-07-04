import { NextRequest, NextResponse } from 'next/server'
import { getSubTasksForCategory } from '@/lib/subtasks'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
    }

    const subTasks = getSubTasksForCategory(categoryId, categoryName || undefined)
    return NextResponse.json({ categoryId, subTasks })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load sub-tasks' }, { status: 500 })
  }
}

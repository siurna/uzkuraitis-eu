"use client"

import { createContext, useContext, useRef, useState } from "react"

// Create a context with default values
const DragDropContextInternal = createContext({
  dragging: null,
  setDragging: (id) => {},
  dragSource: null,
  setDragSource: (source) => {},
  dragOverDroppable: null,
  setDragOverDroppable: (droppable) => {},
  handleDragEnd: () => {},
})

// DragDropContext component
export const DragDropContext = ({ children, onDragEnd }) => {
  const [dragging, setDragging] = useState(null)
  const [dragSource, setDragSource] = useState(null)
  const [dragOverDroppable, setDragOverDroppable] = useState(null)

  const handleDragEnd = () => {
    if (dragging && dragSource && dragOverDroppable) {
      onDragEnd({
        draggableId: dragging,
        source: {
          droppableId: dragSource.droppableId,
          index: dragSource.index,
        },
        destination: dragOverDroppable
          ? {
              droppableId: dragOverDroppable.droppableId,
              index: 0, // We're simplifying to always place at index 0
            }
          : null,
      })
    }

    setDragging(null)
    setDragSource(null)
    setDragOverDroppable(null)
  }

  const contextValue = {
    dragging,
    setDragging,
    dragSource,
    setDragSource,
    dragOverDroppable,
    setDragOverDroppable,
    handleDragEnd,
  }

  return <DragDropContextInternal.Provider value={contextValue}>{children}</DragDropContextInternal.Provider>
}

// Droppable component
export const Droppable = ({ children, droppableId, isDropDisabled = false, direction = "vertical" }) => {
  const { dragging, dragOverDroppable, setDragOverDroppable, handleDragEnd } = useContext(DragDropContextInternal)
  const ref = useRef(null)

  const handleDragOver = (e) => {
    if (isDropDisabled || !dragging) return
    e.preventDefault()
    setDragOverDroppable({ droppableId })
  }

  const handleDragLeave = () => {
    if (dragOverDroppable?.droppableId === droppableId) {
      setDragOverDroppable(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleDragEnd()
  }

  // Safely determine if we're dragging over this droppable
  const isDraggingOver = Boolean(dragOverDroppable && dragOverDroppable.droppableId === droppableId)

  // Ensure children is a function and call it with the required props
  const childrenProps = {
    isDraggingOver,
    innerRef: ref,
    droppableProps: {
      "data-droppable-id": droppableId,
    },
    placeholder: null,
  }

  return (
    <div
      ref={ref}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-droppable-id={droppableId}
      className={direction === "horizontal" ? "flex flex-wrap" : ""}
    >
      {typeof children === "function" ? children(childrenProps) : children}
    </div>
  )
}

// Draggable component
export const Draggable = ({ children, draggableId, index }) => {
  const { setDragging, setDragSource, handleDragEnd } = useContext(DragDropContextInternal)
  const [isDragging, setIsDragging] = useState(false)
  const ref = useRef(null)

  const handleDragStart = (e) => {
    const droppableElement = e.currentTarget.closest("[data-droppable-id]")
    const droppableId = droppableElement ? droppableElement.dataset.droppableId : null

    setDragging(draggableId)
    setDragSource({ droppableId, index })
    setIsDragging(true)

    // Required for Firefox
    e.dataTransfer.setData("text/plain", draggableId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDraggableDragEnd = (e) => {
    setIsDragging(false)
    // Call the context's handleDragEnd
    handleDragEnd()
  }

  const childrenProps = {
    draggableProps: {
      draggable: true,
      onDragStart: handleDragStart,
      onDragEnd: handleDraggableDragEnd,
      "data-draggable-id": draggableId,
    },
    dragHandleProps: {},
    innerRef: ref,
    isDragging,
  }

  return <div ref={ref}>{typeof children === "function" ? children(childrenProps) : children}</div>
}

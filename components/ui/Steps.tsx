'use client'

import { useState } from 'react'
import { FiCheck } from 'react-icons/fi'

interface Step {
  id: number
  title: string
  description: string
}

interface StepsProps {
  steps: Step[]
  currentStep: number
}

export function Steps({ steps, currentStep }: StepsProps) {
  return (
    <div className="flex items-center justify-between mb-12">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                index + 1 <= currentStep
                  ? 'bg-primary-500 text-dark-900'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index + 1 < currentStep ? <FiCheck /> : step.id}
            </div>
            <span className={`mt-2 text-sm font-medium ${
              index + 1 <= currentStep ? 'text-dark-900' : 'text-gray-500'
            }`}>
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-20 h-1 mx-4 rounded transition-all duration-300 ${
                index + 1 < currentStep ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
